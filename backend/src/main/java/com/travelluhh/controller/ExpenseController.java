package com.travelluhh.controller;

import com.travelluhh.dto.expense.CreateExpenseRequest;
import com.travelluhh.dto.expense.ExpenseResponse;
import com.travelluhh.service.ExpenseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
public class ExpenseController {

    private final ExpenseService expenseService;

    @PostMapping
    public ResponseEntity<ExpenseResponse> createExpense(
            @Validated(CreateExpenseRequest.OnCreate.class) @RequestBody CreateExpenseRequest request,
            Authentication authentication
    ) {
        ExpenseResponse response = expenseService.createExpense(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/trip/{tripId}")
    public ResponseEntity<List<ExpenseResponse>> getExpensesByTrip(
            @PathVariable Long tripId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(expenseService.getExpensesByTrip(tripId, authentication.getName()));
    }

    /** Same body as POST; tripId may be omitted but must match when sent. Replaces sub-items when sent. */
    @PutMapping("/{expenseId}")
    public ResponseEntity<ExpenseResponse> updateExpense(
            @PathVariable Long expenseId,
            @Valid @RequestBody CreateExpenseRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(expenseService.updateExpense(expenseId, request, authentication.getName()));
    }

    @DeleteMapping("/{expenseId}")
    public ResponseEntity<Void> deleteExpense(
            @PathVariable Long expenseId,
            Authentication authentication
    ) {
        expenseService.deleteExpense(expenseId, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
