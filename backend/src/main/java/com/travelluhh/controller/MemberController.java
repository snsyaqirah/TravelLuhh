package com.travelluhh.controller;

import com.travelluhh.dto.member.AddMemberRequest;
import com.travelluhh.dto.member.UpdateMemberRoleRequest;
import com.travelluhh.dto.trip.TripResponse.MemberDto;
import com.travelluhh.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Trip members. Listing: any member. Add, change role, remove: owner. Leave: any non-owner member. */
@RestController
@RequestMapping("/api/trips/{tripId}")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping("/members")
    public ResponseEntity<List<MemberDto>> list(@PathVariable Long tripId, Authentication authentication) {
        return ResponseEntity.ok(memberService.listMembers(tripId, authentication.getName()));
    }

    @PostMapping("/members")
    public ResponseEntity<MemberDto> add(
            @PathVariable Long tripId,
            @Valid @RequestBody AddMemberRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(memberService.addMember(tripId, request, authentication.getName()));
    }

    @PatchMapping("/members/{memberId}")
    public ResponseEntity<MemberDto> changeRole(
            @PathVariable Long tripId,
            @PathVariable Long memberId,
            @Valid @RequestBody UpdateMemberRoleRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(memberService.changeRole(tripId, memberId, request, authentication.getName()));
    }

    @DeleteMapping("/members/{memberId}")
    public ResponseEntity<Void> remove(
            @PathVariable Long tripId,
            @PathVariable Long memberId,
            Authentication authentication
    ) {
        memberService.removeMember(tripId, memberId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/leave")
    public ResponseEntity<Void> leave(@PathVariable Long tripId, Authentication authentication) {
        memberService.leave(tripId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
