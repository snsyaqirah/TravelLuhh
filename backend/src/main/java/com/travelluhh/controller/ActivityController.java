package com.travelluhh.controller;

import com.travelluhh.dto.activity.ActivityResponse;
import com.travelluhh.service.ActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The trip logbook. Any member; newest first, at most 100 rows. */
@RestController
@RequestMapping("/api/trips/{tripId}/activity")
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService activityService;

    @GetMapping
    public ResponseEntity<List<ActivityResponse>> getActivities(@PathVariable Long tripId, Authentication authentication) {
        return ResponseEntity.ok(activityService.getActivities(tripId, authentication.getName()));
    }
}
