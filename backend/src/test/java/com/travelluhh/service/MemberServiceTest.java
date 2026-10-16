package com.travelluhh.service;

import com.travelluhh.dto.member.AddMemberRequest;
import com.travelluhh.dto.member.UpdateMemberRoleRequest;
import com.travelluhh.dto.trip.TripResponse.MemberDto;
import com.travelluhh.entity.Trip;
import com.travelluhh.entity.TripMember;
import com.travelluhh.entity.TripMember.MemberRole;
import com.travelluhh.entity.User;
import com.travelluhh.exception.BadRequestException;
import com.travelluhh.exception.ConflictException;
import com.travelluhh.exception.ForbiddenException;
import com.travelluhh.exception.NotFoundException;
import com.travelluhh.repository.TripMemberBudgetRepository;
import com.travelluhh.repository.TripMemberRepository;
import com.travelluhh.repository.TripRepository;
import com.travelluhh.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MemberServiceTest {

    private static final long TRIP_ID = 9L;
    private static final User OWNER = user(1L, "Aiman");
    private static final User EDITOR = user(2L, "Siti");
    private static final User VIEWER = user(3L, "Chong");
    private static final User STRANGER = user(4L, "Mei");

    @Mock private TripMemberRepository tripMemberRepository;
    @Mock private TripMemberBudgetRepository budgetRepository;
    @Mock private UserRepository userRepository;
    @Mock private TripRepository tripRepository;
    @Mock private ActivityService activityService;

    private MemberService service;
    private Trip trip;
    private final List<TripMember> rows = new ArrayList<>();
    private TripMember ownerRow;
    private TripMember editorRow;
    private TripMember viewerRow;

    private static User user(long id, String name) {
        return User.builder().id(id).name(name).email(name.toLowerCase() + "@example.test").build();
    }

    private TripMember row(long memberId, User u, MemberRole role) {
        TripMember m = TripMember.builder().id(memberId).trip(trip).userId(u.getId()).user(u).role(role)
                .joinedAt(LocalDateTime.of(2026, 10, 1, 9, 0).plusMinutes(memberId)).build();
        rows.add(m);
        return m;
    }

    @BeforeEach
    void setUp() {
        TripAccessService access = new TripAccessService(tripRepository, tripMemberRepository, userRepository);
        service = new MemberService(tripMemberRepository, budgetRepository, userRepository, access, activityService);

        trip = Trip.builder().id(TRIP_ID).ownerId(OWNER.getId()).currency("MYR").name("Tokyo autumn").build();
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        for (User u : List.of(OWNER, EDITOR, VIEWER, STRANGER)) {
            when(userRepository.findByEmail(u.getEmail())).thenReturn(Optional.of(u));
            when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        }
        ownerRow = row(100, OWNER, MemberRole.owner);
        editorRow = row(101, EDITOR, MemberRole.editor);
        viewerRow = row(102, VIEWER, MemberRole.viewer);

        when(tripMemberRepository.findByTripIdWithUser(TRIP_ID)).thenReturn(rows);
        when(tripMemberRepository.findRole(eq(TRIP_ID), anyLong())).thenAnswer(inv -> rows.stream()
                .filter(m -> m.getUserId().equals(inv.getArgument(1)))
                .map(TripMember::getRole)
                .findFirst());
        when(tripMemberRepository.existsByTripIdAndUserId(eq(TRIP_ID), anyLong())).thenAnswer(inv -> rows.stream()
                .anyMatch(m -> m.getUserId().equals(inv.getArgument(1))));
        when(tripMemberRepository.findByIdAndTripId(anyLong(), eq(TRIP_ID))).thenAnswer(inv -> rows.stream()
                .filter(m -> m.getId().equals(inv.getArgument(0)))
                .findFirst());
        when(tripMemberRepository.findByTripIdAndUserId(eq(TRIP_ID), anyLong())).thenAnswer(inv -> rows.stream()
                .filter(m -> m.getUserId().equals(inv.getArgument(1)))
                .findFirst());
        when(tripMemberRepository.saveAndFlush(any(TripMember.class))).thenAnswer(inv -> {
            TripMember m = inv.getArgument(0);
            m.setId(200L);
            return m;
        });
        when(tripMemberRepository.save(any(TripMember.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Nested
    class Listing {

        @Test
        void anyMemberSeesEveryoneOwnerFirst() {
            List<MemberDto> members = service.listMembers(TRIP_ID, VIEWER.getEmail());

            assertThat(members).extracting(MemberDto::getUserId).containsExactly(1L, 2L, 3L);
            assertThat(members).extracting(MemberDto::getRole).containsExactly("owner", "editor", "viewer");
            assertThat(members.get(1).getId()).isEqualTo(101L);
            assertThat(members.get(1).getEmail()).isEqualTo("siti@example.test");
        }

        @Test
        void strangersGet404() {
            assertThatThrownBy(() -> service.listMembers(TRIP_ID, STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage(TripAccessService.TRIP_NOT_FOUND);
        }

        @Test
        void rosterIncludesAnOwnerWithoutARow() {
            rows.remove(ownerRow);

            List<TripMember> roster = service.roster(trip);

            assertThat(roster).extracting(TripMember::getUserId).containsExactly(1L, 2L, 3L);
            assertThat(roster.get(0).getId()).isNull();
            assertThat(roster.get(0).getUser()).isEqualTo(OWNER);
        }

        @Test
        void aStrayOwnerRowCountsAsEditor() {
            editorRow.setRole(MemberRole.owner);

            List<MemberDto> members = service.listMembers(TRIP_ID, OWNER.getEmail());

            assertThat(members.get(1).getRole()).isEqualTo("editor");
        }
    }

    @Nested
    class Adding {

        @Test
        void ownerAddsAnExistingAccountAsViewer() {
            MemberDto dto = service.addMember(TRIP_ID, new AddMemberRequest(STRANGER.getEmail(), "viewer"), OWNER.getEmail());

            ArgumentCaptor<TripMember> saved = ArgumentCaptor.forClass(TripMember.class);
            verify(tripMemberRepository).saveAndFlush(saved.capture());
            assertThat(saved.getValue().getUserId()).isEqualTo(STRANGER.getId());
            assertThat(saved.getValue().getRole()).isEqualTo(MemberRole.viewer);
            assertThat(saved.getValue().getTrip()).isSameAs(trip);
            assertThat(dto.getId()).isEqualTo(200L);
            assertThat(dto.getName()).isEqualTo("Mei");
            assertThat(dto.getRole()).isEqualTo("viewer");
            verify(activityService).log(eq(TRIP_ID), eq(OWNER.getId()), eq("Aiman"), eq("member_added"),
                    eq("Aiman added Mei as a viewer"));
        }

        @Test
        void roleDefaultsToEditor() {
            MemberDto dto = service.addMember(TRIP_ID, new AddMemberRequest(STRANGER.getEmail(), null), OWNER.getEmail());

            assertThat(dto.getRole()).isEqualTo("editor");
        }

        @Test
        void emailIsMatchedCaseInsensitively() {
            service.addMember(TRIP_ID, new AddMemberRequest("  Mei@Example.TEST ", "editor"), OWNER.getEmail());

            verify(userRepository).findByEmail("mei@example.test");
        }

        @Test
        void unknownEmailIs404WithTheContractMessage() {
            when(userRepository.findByEmail("nobody@example.test")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.addMember(TRIP_ID,
                    new AddMemberRequest("nobody@example.test", "editor"), OWNER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage("No TravelLuhh account uses that email yet. Ask them to sign up first.");
            verify(tripMemberRepository, never()).saveAndFlush(any());
        }

        @Test
        void existingMemberIs409() {
            assertThatThrownBy(() -> service.addMember(TRIP_ID,
                    new AddMemberRequest(EDITOR.getEmail(), "viewer"), OWNER.getEmail()))
                    .isInstanceOf(ConflictException.class)
                    .hasMessage("Siti is already on this trip");
        }

        @Test
        void ownerAddingThemselvesIs409() {
            assertThatThrownBy(() -> service.addMember(TRIP_ID,
                    new AddMemberRequest(OWNER.getEmail(), "editor"), OWNER.getEmail()))
                    .isInstanceOf(ConflictException.class);
        }

        @Test
        void ownerRoleCantBeGranted() {
            assertThatThrownBy(() -> service.addMember(TRIP_ID,
                    new AddMemberRequest(STRANGER.getEmail(), "owner"), OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage(MemberService.ROLE_INVALID);
        }

        @Test
        void editorsCantAdd() {
            assertThatThrownBy(() -> service.addMember(TRIP_ID,
                    new AddMemberRequest(STRANGER.getEmail(), "editor"), EDITOR.getEmail()))
                    .isInstanceOf(ForbiddenException.class)
                    .hasMessage(TripAccessService.OWNER_ONLY);
        }

        @Test
        void strangersCantAdd() {
            assertThatThrownBy(() -> service.addMember(TRIP_ID,
                    new AddMemberRequest("x@example.test", "editor"), STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage(TripAccessService.TRIP_NOT_FOUND);
        }
    }

    @Nested
    class ChangingRoles {

        @Test
        void ownerMakesAnEditorAViewer() {
            MemberDto dto = service.changeRole(TRIP_ID, 101L, new UpdateMemberRoleRequest("viewer"), OWNER.getEmail());

            assertThat(editorRow.getRole()).isEqualTo(MemberRole.viewer);
            assertThat(dto.getRole()).isEqualTo("viewer");
            verify(tripMemberRepository).save(editorRow);
            verify(activityService).log(eq(TRIP_ID), eq(OWNER.getId()), eq("Aiman"), eq("member_role_changed"),
                    eq("Aiman made Siti a viewer"));
        }

        @Test
        void sameRoleIsANoOp() {
            service.changeRole(TRIP_ID, 101L, new UpdateMemberRoleRequest("editor"), OWNER.getEmail());

            verify(tripMemberRepository, never()).save(any());
            verify(activityService, never()).log(anyLong(), anyLong(), anyString(), anyString(), anyString());
        }

        @Test
        void theOwnersRowCantChange() {
            assertThatThrownBy(() -> service.changeRole(TRIP_ID, 100L, new UpdateMemberRoleRequest("viewer"), OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage(MemberService.OWNER_ROLE_FIXED);
        }

        @Test
        void unknownMemberIdIs404() {
            assertThatThrownBy(() -> service.changeRole(TRIP_ID, 999L, new UpdateMemberRoleRequest("viewer"), OWNER.getEmail()))
                    .isInstanceOf(NotFoundException.class)
                    .hasMessage(MemberService.MEMBER_NOT_FOUND);
        }

        @Test
        void editorsCantChangeRoles() {
            assertThatThrownBy(() -> service.changeRole(TRIP_ID, 102L, new UpdateMemberRoleRequest("editor"), EDITOR.getEmail()))
                    .isInstanceOf(ForbiddenException.class);
        }

        @Test
        void invalidRoleIs400() {
            assertThatThrownBy(() -> service.changeRole(TRIP_ID, 101L, new UpdateMemberRoleRequest("admin"), OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @Nested
    class Removing {

        @Test
        void ownerRemovesAMemberAndTheirAllocation() {
            service.removeMember(TRIP_ID, 102L, OWNER.getEmail());

            verify(tripMemberRepository).delete(viewerRow);
            verify(budgetRepository).deleteByTripIdAndUserId(TRIP_ID, VIEWER.getId());
            verify(activityService).log(eq(TRIP_ID), eq(OWNER.getId()), eq("Aiman"), eq("member_removed"),
                    eq("Aiman removed Chong from the trip"));
        }

        @Test
        void theOwnerCantBeRemoved() {
            assertThatThrownBy(() -> service.removeMember(TRIP_ID, 100L, OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage(MemberService.OWNER_CANNOT_BE_REMOVED);
            verify(tripMemberRepository, never()).delete(any());
        }

        @Test
        void editorsCantRemove() {
            assertThatThrownBy(() -> service.removeMember(TRIP_ID, 102L, EDITOR.getEmail()))
                    .isInstanceOf(ForbiddenException.class);
            verify(tripMemberRepository, never()).delete(any());
        }
    }

    @Nested
    class Leaving {

        @Test
        void aMemberLeaves() {
            service.leave(TRIP_ID, VIEWER.getEmail());

            verify(tripMemberRepository).delete(viewerRow);
            verify(budgetRepository).deleteByTripIdAndUserId(TRIP_ID, VIEWER.getId());
            verify(activityService).log(eq(TRIP_ID), eq(VIEWER.getId()), eq("Chong"), eq("member_left"),
                    eq("Chong left the trip"));
        }

        @Test
        void theOwnerCantLeave() {
            assertThatThrownBy(() -> service.leave(TRIP_ID, OWNER.getEmail()))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("Transfer or delete the trip instead");
            verify(tripMemberRepository, never()).delete(any());
        }

        @Test
        void strangersGet404() {
            assertThatThrownBy(() -> service.leave(TRIP_ID, STRANGER.getEmail()))
                    .isInstanceOf(NotFoundException.class);
        }
    }
}
