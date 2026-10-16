package com.travelluhh.repository;

import com.travelluhh.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository interface for User entity
 * 
 * Spring Data JPA will automatically implement this interface!
 * No need to write implementation - Spring generates it at runtime
 * 
 * JpaRepository provides built-in methods:
 * - save(entity): Insert or update
 * - findById(id): Find by primary key
 * - findAll(): Get all records
 * - deleteById(id): Delete by primary key
 * - count(): Count all records
 * - etc.
 * 
 * We can also define custom query methods using naming conventions
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Find user by email
     * Spring Data JPA will generate the SQL: SELECT * FROM users WHERE email = ?
     * 
     * Returns Optional<User> to handle null safely
     * - Optional.empty() if not found
     * - Optional.of(user) if found
     */
    Optional<User> findByEmail(String email);

    /**
     * Find user by email, ignoring case (member invites: people type addresses in any case).
     * Spring generates: SELECT * FROM users WHERE UPPER(email) = UPPER(?)
     */
    Optional<User> findByEmailIgnoreCase(String email);

    /**
     * Check if user exists by email
     * Spring generates: SELECT COUNT(*) > 0 FROM users WHERE email = ?
     */
    boolean existsByEmail(String email);

    /**
     * Find user by Google ID (for OAuth login)
     */
    Optional<User> findByGoogleId(String googleId);

}
