import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTripInput, CreateTripRequest, Trip, UpdateTripInput, UpdateTripRequest } from '@/types';
import { tripService } from '@/services/tripService';
import { AppError, getErrorMessage, getErrorStatus, toAppError } from '@/lib/axios';
import { queryKeys } from '@/lib/queryClient';
import { toId } from '@/lib/ids';

const EMPTY: Trip[] = [];
const LIVE_POLL_MS = 25_000;

/** Accepts the contract shape or the pre-revamp TripForm shape (totalBudget, favoriteCurrency). */
export function toCreateTripRequest(input: CreateTripInput | CreateTripRequest): CreateTripRequest {
  const legacy = input as CreateTripInput;
  return {
    name: input.name.trim(),
    destinationCountry: input.destinationCountry,
    startDate: input.startDate,
    endDate: input.endDate,
    budget: Number(input.budget ?? legacy.totalBudget ?? 0),
    currency: (input.currency ?? legacy.favoriteCurrency ?? '').toUpperCase(),
    budgetType: input.budgetType ?? 'solo',
    season: input.season ?? undefined,
    description: input.description || undefined,
    notes: input.notes || undefined,
  };
}

/** Only the fields that were given; undefined is dropped so the PUT stays partial. */
export function toUpdateTripRequest(input: UpdateTripInput): UpdateTripRequest {
  const out: UpdateTripRequest = {};
  const budget = input.budget ?? input.totalBudget;
  const currency = input.currency ?? input.favoriteCurrency;
  if (input.name !== undefined) out.name = input.name.trim();
  if (input.destinationCountry !== undefined) out.destinationCountry = input.destinationCountry;
  if (input.startDate !== undefined) out.startDate = input.startDate;
  if (input.endDate !== undefined) out.endDate = input.endDate;
  if (budget !== undefined) out.budget = Number(budget);
  if (currency !== undefined) out.currency = currency.toUpperCase();
  if (input.budgetType !== undefined) out.budgetType = input.budgetType;
  if (input.season !== undefined) out.season = input.season;
  if (input.description !== undefined) out.description = input.description;
  if (input.notes !== undefined) out.notes = input.notes;
  if (input.image !== undefined) out.image = input.image;
  if (input.isArchived !== undefined) out.isArchived = input.isArchived;
  return out;
}

export interface UseTripsOptions {
  archived?: boolean;
  enabled?: boolean;
}

export function useTrips(opts: UseTripsOptions = {}) {
  const archived = opts.archived ?? false;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.trips(archived),
    queryFn: () => tripService.getAllTrips({ archived }),
    enabled: opts.enabled !== false,
  });

  const putTrip = useCallback(
    (trip: Trip) => {
      qc.setQueryData(queryKeys.trip(trip.id), trip);
      qc.setQueryData<Trip[]>(queryKeys.trips(trip.isArchived), (old) =>
        old ? (old.some((t) => t.id === trip.id) ? old.map((t) => (t.id === trip.id ? trip : t)) : [...old, trip]) : old
      );
      // Archiving moves a trip between the two lists.
      qc.setQueryData<Trip[]>(queryKeys.trips(!trip.isArchived), (old) => old?.filter((t) => t.id !== trip.id));
    },
    [qc]
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateTripInput | CreateTripRequest) => tripService.createTrip(toCreateTripRequest(input)),
    onSuccess: (trip) => {
      putTrip(trip);
      void qc.invalidateQueries({ queryKey: queryKeys.tripsAll });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateTripInput) => {
      const id = toId(input.id);
      if (!id) throw new AppError('This trip could not be found.');
      return tripService.updateTrip(id, toUpdateTripRequest(input));
    },
    onSuccess: (trip) => {
      putTrip(trip);
      void qc.invalidateQueries({ queryKey: queryKeys.tripsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.activity(trip.id) });
      // Budget or dates change every derived number.
      void qc.invalidateQueries({ queryKey: queryKeys.budgets(trip.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.fund(trip.id) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await tripService.deleteTrip(id);
      return id;
    },
    onSuccess: (id) => {
      for (const a of [false, true]) {
        qc.setQueryData<Trip[]>(queryKeys.trips(a), (old) => old?.filter((t) => t.id !== id));
      }
      for (const k of ['trip', 'expenses', 'itinerary', 'packing', 'members', 'budgets', 'notes', 'fund', 'settlement', 'activity']) {
        qc.removeQueries({ queryKey: [k, id] });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.tripsAll });
    },
  });

  const { mutateAsync: createAsync } = createMutation;
  const { mutateAsync: updateAsync } = updateMutation;
  const { mutateAsync: deleteAsync } = deleteMutation;

  const createTrip = useCallback(
    async (input: CreateTripInput | CreateTripRequest) => {
      try {
        return await createAsync(input);
      } catch (e) {
        throw toAppError(e, "The tabung didn't open. Try again.");
      }
    },
    [createAsync]
  );

  const updateTrip = useCallback(
    async (input: UpdateTripInput) => {
      try {
        return await updateAsync(input);
      } catch (e) {
        throw toAppError(e, "Changes didn't save. Try again.");
      }
    },
    [updateAsync]
  );

  const deleteTrip = useCallback(
    async (id: number | string) => {
      const tid = toId(id);
      if (!tid) return;
      try {
        await deleteAsync(tid);
      } catch (e) {
        throw toAppError(e, "The trip wasn't deleted. Try again.");
      }
    },
    [deleteAsync]
  );

  const setArchived = useCallback(
    (id: number, isArchived: boolean) => updateTrip({ id, isArchived }),
    [updateTrip]
  );

  const trips = query.data ?? EMPTY;
  const getTripById = useCallback((id: number | string) => trips.find((t) => t.id === toId(id)), [trips]);

  return {
    trips,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? getErrorMessage(query.error) : null,
    refetch: query.refetch,
    /** @deprecated use refetch */
    fetchTrips: query.refetch,
    createTrip,
    updateTrip,
    deleteTrip,
    setArchived,
    getTripById,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export interface UseTripOptions {
  /** Poll every 25 s (group trips on the road). */
  live?: boolean;
  enabled?: boolean;
}

/** One trip. Renders straight away from the trips list cache when it is there. */
export function useTrip(tripId: number | string | undefined, opts: UseTripOptions = {}) {
  const id = toId(tripId);
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.trip(id ?? 0),
    queryFn: () => tripService.getTripById(id as number),
    enabled: id !== undefined && opts.enabled !== false,
    refetchInterval: opts.live ? LIVE_POLL_MS : false,
    initialData: () => {
      if (!id) return undefined;
      for (const a of [false, true]) {
        const hit = qc.getQueryData<Trip[]>(queryKeys.trips(a))?.find((t) => t.id === id);
        if (hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(queryKeys.trips(false))?.dataUpdatedAt ?? qc.getQueryState(queryKeys.trips(true))?.dataUpdatedAt,
  });

  return {
    trip: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? getErrorMessage(query.error) : null,
    /** Deleted, or not a member (the API answers 404/403 rather than leak the trip). */
    notFound: [403, 404].includes(getErrorStatus(query.error) ?? 0),
    refetch: query.refetch,
  };
}
