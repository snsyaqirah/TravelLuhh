package com.travelluhh.repository;

import com.travelluhh.entity.EmailVerificationCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EmailVerificationCodeRepository extends JpaRepository<EmailVerificationCode, Long> {

    /**
     * The code a user is currently guessing against. Row-locked so parallel guesses are counted one at a time
     * and can't slip past the attempt limit.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<EmailVerificationCode> findTopByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(
            String email, String purpose);

    @Modifying
    @Query("UPDATE EmailVerificationCode e SET e.used = true WHERE e.email = :email AND e.purpose = :purpose AND e.used = false")
    void markAllUsedByEmailAndPurpose(@Param("email") String email, @Param("purpose") String purpose);
}
