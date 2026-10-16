package com.travelluhh.dto.packing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PackingItemRequest {

    @NotBlank(message = "Item label is required")
    @Size(max = 255, message = "Item label can't be longer than 255 characters")
    private String label;

    @Size(max = 50, message = "Category can't be longer than 50 characters")
    private String category;
}
