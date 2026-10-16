// DELETE paths shared by the services (axios) and the keepalive sender used when the page is hidden, so the
// two can't drift apart. Relative to the API root.
export const apiPaths = {
  expense: (expenseId: number) => `/expenses/${expenseId}`,
  itineraryItem: (tripId: number, itemId: number) => `/trips/${tripId}/itinerary/${itemId}`,
  packingItem: (tripId: number, itemId: number) => `/trips/${tripId}/packing/${itemId}`,
  note: (tripId: number, noteId: number) => `/trips/${tripId}/notes/${noteId}`,
};
