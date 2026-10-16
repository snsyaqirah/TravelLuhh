package com.travelluhh.controller;

import com.travelluhh.exception.GlobalExceptionHandler;
import com.travelluhh.service.BudgetService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PUT /api/trips/{id}/budgets takes a bare JSON array, so @Digits on each allocation only runs because
 * the parameter is {@code @Valid List<...>} (Spring 6.1 method validation).
 */
class BudgetControllerValidationTest {

    private final BudgetService budgetService = mock(BudgetService.class);
    private LocalValidatorFactoryBean validator;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mvc = MockMvcBuilders.standaloneSetup(new BudgetController(budgetService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
        when(budgetService.updateBudgets(anyLong(), anyList(), any())).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        validator.close();
    }

    @Test
    void hugeExponentsInTheListAreA400BeforeTheService() throws Exception {
        for (String allocated : List.of("1e-20000000", "1e20000000", "12.345")) {
            mvc.perform(put("/api/trips/9/budgets")
                            .principal(new UsernamePasswordAuthenticationToken("aiman@example.com", null, List.of()))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("[{\"userId\":2,\"allocated\":1500},{\"userId\":3,\"allocated\":" + allocated + "}]"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Budgets can have at most 10 digits and 2 decimals"));
        }
        verify(budgetService, never()).updateBudgets(anyLong(), anyList(), any());
    }

    @Test
    void ordinaryAllocationsReachTheService() throws Exception {
        mvc.perform(put("/api/trips/9/budgets")
                        .principal(new UsernamePasswordAuthenticationToken("aiman@example.com", null, List.of()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"userId\":2,\"allocated\":1500.5},{\"userId\":3,\"allocated\":0}]"))
                .andExpect(status().isOk());
        verify(budgetService).updateBudgets(eq(9L), anyList(), eq("aiman@example.com"));
    }
}
