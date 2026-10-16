package com.travelluhh.dto.packing;

import lombok.Data;

/** Body for POST /api/trips/{tripId}/packing/preset: { "preset": "beach" }. */
@Data
public class PackingPresetRequest {
    /** general | beach | hiking | business | umrah */
    private String preset;
}
