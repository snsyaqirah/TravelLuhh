package com.travelluhh.controller;

import com.travelluhh.dto.budget.BudgetAllocationRequest;
import com.travelluhh.dto.budget.MemberBudgetResponse;
import com.travelluhh.service.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Per-person budgets for separated trips. GET: any member. PUT: owner. */
@RestController
@RequestMapping("/api/trips/{tripId}/budgets")
@RequiredArgsConstructor
public class BudgetController {

    private final BudgetService budgetService;

    @GetMapping
    public ResponseEntity<List<MemberBudgetResponse>> get(@PathVariable Long tripId, Authentication authentication) {
        return ResponseEntity.ok(budgetService.getBudgets(tripId, authentication.getName()));
    }

    /** Body: [{"userId": 2, "allocated": 1500.00}, ...]. allocated 0 removes that person's budget. */
    @PutMapping
    public ResponseEntity<List<MemberBudgetResponse>> put(
            @PathVariable Long tripId,
            @RequestBody List<BudgetAllocationRequest> allocations,
            Authentication authentication
    ) {
        return ResponseEntity.ok(budgetService.updateBudgets(tripId, allocations, authentication.getName()));
    }
}
