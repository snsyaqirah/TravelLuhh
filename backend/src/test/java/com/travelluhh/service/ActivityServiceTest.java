package com.travelluhh.service;

import com.travelluhh.dto.activity.ActivityResponse;
import com.travelluhh.entity.TripActivity;
import com.travelluhh.repository.TripActivityRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ActivityServiceTest {

    @Mock private TripActivityRepository activityRepository;
    @Mock private PlatformTransactionManager transactionManager;
    @Mock private TripRepository tripRepository;
    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private UserRepository userRepository;

    private ActivityService service;

    @BeforeEach
    void setUp() {
        when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new ActivityService(activityRepository, transactionManager,
                new TripAccessService(tripRepository, tripMemberRepository, userRepository));
    }

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    /** What Spring does at commit: afterCommit callbacks, then a fresh read of the list for afterCompletion. */
    private static void commit() {
        for (TransactionSynchronization s : TransactionSynchronizationManager.getSynchronizations()) {
            s.afterCommit();
        }
        List<TransactionSynchronization> all = TransactionSynchronizationManager.getSynchronizations();
        TransactionSynchronizationManager.clearSynchronization();
        all.forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
    }

    private static void rollback() {
        List<TransactionSynchronization> all = TransactionSynchronizationManager.getSynchronizations();
        TransactionSynchronizationManager.clearSynchronization();
        all.forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
    }

    @Test
    void outsideATransactionTheRowIsWrittenAtOnceInItsOwnTransaction() {
        service.log(9L, 2L, "Siti", "fund_added", "Siti put MYR 200.00 in the tabung");

        ArgumentCaptor<TripActivity> row = ArgumentCaptor.forClass(TripActivity.class);
        verify(activityRepository).save(row.capture());
        assertThat(row.getValue().getTripId()).isEqualTo(9L);
        assertThat(row.getValue().getUserId()).isEqualTo(2L);
        assertThat(row.getValue().getActorName()).isEqualTo("Siti");
        assertThat(row.getValue().getActionType()).isEqualTo("fund_added");
        assertThat(row.getValue().getDescription()).isEqualTo("Siti put MYR 200.00 in the tabung");

        ArgumentCaptor<TransactionDefinition> definition = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(transactionManager).getTransaction(definition.capture());
        assertThat(definition.getValue().getPropagationBehavior())
                .isEqualTo(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Test
    void insideATransactionTheRowWaitsForTheCommit() {
        TransactionSynchronizationManager.initSynchronization();

        service.log(9L, 2L, "Siti", "note_saved", "Siti added the note \"Getting around\"");
        verify(activityRepository, never()).save(any());

        commit();
        verify(activityRepository).save(any(TripActivity.class));
    }

    @Test
    void aRolledBackChangeLeavesNoRow() {
        TransactionSynchronizationManager.initSynchronization();

        service.log(9L, 2L, "Siti", "note_saved", "Siti added a note");
        rollback();

        verify(activityRepository, never()).save(any());
    }

    @Test
    void loggingFromAnAfterCommitHookIsNotLost() {
        // TripService logs trip_created this way.
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                service.log(9L, 1L, "Aiman", "trip_created", "Aiman created the trip \"Tokyo autumn\"");
            }
        });

        commit();

        verify(activityRepository).save(any(TripActivity.class));
    }

    @Test
    void aFailedWriteNeverReachesTheCaller() {
        when(activityRepository.save(any())).thenThrow(new IllegalStateException("db down"));

        assertThatCode(() -> service.log(9L, 2L, "Siti", "fund_added", "Siti put MYR 1.00 in the tabung"))
                .doesNotThrowAnyException();
    }

    @Test
    void longTextIsTrimmedToTheColumnSizes() {
        service.log(9L, 2L, "S".repeat(150), "fund_added", "x".repeat(5000));

        ArgumentCaptor<TripActivity> row = ArgumentCaptor.forClass(TripActivity.class);
        verify(activityRepository).save(row.capture());
        assertThat(row.getValue().getActorName()).hasSize(100);
        assertThat(row.getValue().getDescription()).hasSize(1000).endsWith("...");
    }

    @Test
    void feedIsMappedNewestFirstFromTheTop100Query() {
        LocalDateTime now = LocalDateTime.of(2026, 11, 14, 21, 4);
        when(activityRepository.findTop100ByTripIdOrderByCreatedAtDescIdDesc(9L)).thenReturn(List.of(
                TripActivity.builder().id(2L).tripId(9L).userId(2L).actorName("Siti").actionType("expense_added")
                        .description("Siti added MYR 38.40 for \"Ramen\"").createdAt(now).build(),
                TripActivity.builder().id(1L).tripId(9L).userId(1L).actorName("Aiman").actionType("trip_created")
                        .description("Aiman created the trip").createdAt(now.minusDays(1)).build()));

        List<ActivityResponse> feed = service.getActivities(9L);

        assertThat(feed).extracting(ActivityResponse::getId).containsExactly(2L, 1L);
        assertThat(feed.get(0).getActorName()).isEqualTo("Siti");
        assertThat(feed.get(0).getActionType()).isEqualTo("expense_added");
        assertThat(feed.get(0).getCreatedAt()).isEqualTo(now);
    }
}
