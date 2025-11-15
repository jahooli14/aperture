import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Place = Database['public']['Tables']['places']['Row'];
type PlaceInsert = Database['public']['Tables']['places']['Insert'];
type PlaceUpdate = Database['public']['Tables']['places']['Update'];
type PhotoPlace = Database['public']['Tables']['photo_places']['Row'];
type PlaceWithStats = Database['public']['Views']['places_with_stats']['Row'];

// Visit types (will be auto-generated once migration runs)
type PlaceVisit = {
  id: string;
  place_id: string;
  user_id: string;
  visit_date: string; // ISO date string (YYYY-MM-DD)
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type PlaceVisitInsert = {
  place_id: string;
  visit_date: string;
  notes?: string | null;
};

// Input type for adding places (user_id is added automatically)
type AddPlaceInput = {
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  category?: 'pub' | 'restaurant' | 'cafe' | 'park' | 'beach' | 'relative_house' | 'nursery' | 'playgroup' | 'soft_play' | 'attraction' | 'landmark' | 'other';
};

// Input type for linking photo to place
type LinkPhotoInput = {
  photo_id: string;
  place_id: string;
  notes?: string | null;
  visit_id?: string | null; // Optional: link to specific visit
};

interface PlaceStore {
  places: Place[];
  placesWithStats: PlaceWithStats[];
  photoPlaces: PhotoPlace[];
  placeVisits: PlaceVisit[];
  loading: boolean;
  error: string | null;

  // Place CRUD operations
  fetchPlaces: () => Promise<void>;
  fetchPlacesWithStats: () => Promise<void>;
  addPlace: (place: AddPlaceInput) => Promise<Place>;
  updatePlace: (id: string, updates: PlaceUpdate) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;

  // Visit CRUD operations
  fetchPlaceVisits: () => Promise<void>;
  addPlaceVisit: (visit: PlaceVisitInsert) => Promise<PlaceVisit>;
  updatePlaceVisit: (id: string, visit: Partial<PlaceVisitInsert>) => Promise<void>;
  deletePlaceVisit: (id: string) => Promise<void>;
  getVisitsByPlace: (placeId: string) => PlaceVisit[];

  // Photo-Place linking operations
  fetchPhotoPlaces: () => Promise<void>;
  linkPhotoToPlace: (link: LinkPhotoInput) => Promise<PhotoPlace>;
  unlinkPhotoFromPlace: (photoId: string, placeId: string) => Promise<void>;

  // Utility methods
  getPlacesByPhoto: (photoId: string) => Place[];
  getPhotosByPlace: (placeId: string) => string[];
  getPlaceWithStats: (placeId: string) => PlaceWithStats | undefined;
}

export const usePlaceStore = create<PlaceStore>((set, get) => ({
  places: [],
  placesWithStats: [],
  photoPlaces: [],
  placeVisits: [],
  loading: false,
  error: null,

  fetchPlaces: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Note: Removed .eq('user_id', user.id) filter to allow RLS policies to include shared places
      // RLS policies now handle showing places from:
      // 1. The current user's own places (user_id = auth.uid())
      // 2. Places from accounts this user has joined
      // 3. Places from accounts that have joined this user's account
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching places:', error);
        throw error;
      }

      set({ places: (data || []) as Place[], loading: false });
    } catch (error) {
      console.error('Error fetching places:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch places',
        loading: false,
      });
    }
  },

  fetchPlacesWithStats: async () => {
    console.log('[usePlaceStore] fetchPlacesWithStats START');
    set({ loading: true, error: null });
    try {
      console.log('[usePlaceStore] Getting user...');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[usePlaceStore] User:', user?.id);
      if (!user) {
        throw new Error('Not authenticated');
      }

      console.log('[usePlaceStore] Querying places_with_stats view...');
      // Note: Removed .eq('user_id', user.id) filter to allow RLS policies to include shared places
      // The view's WHERE clause now handles showing places from:
      // 1. The current user's own places (user_id = auth.uid())
      // 2. Places from accounts this user has joined
      // 3. Places from accounts that have joined this user's account
      const { data, error } = await supabase
        .from('places_with_stats')
        .select('*')
        .order('first_visit_date', { ascending: true, nullsFirst: false });

      console.log('[usePlaceStore] Query result:', { dataLength: data?.length, error: error?.message });

      if (error) {
        console.error('[usePlaceStore] Supabase error:', error);
        throw error;
      }

      console.log('[usePlaceStore] Setting places, count:', data?.length || 0);
      set({ placesWithStats: (data || []) as PlaceWithStats[], loading: false });
      console.log('[usePlaceStore] fetchPlacesWithStats COMPLETE');
    } catch (error) {
      console.error('[usePlaceStore] Error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch places with stats',
        loading: false,
      });
    }
  },

  addPlace: async (place: AddPlaceInput) => {
    set({ error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Adding place:', { place, user_id: user.id });

      const insertData: PlaceInsert = {
        ...place,
        user_id: user.id,
      };

      const { data, error } = await (supabase as any)
        .from('places')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);

        // Check if it's a missing table error
        if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
          const helpfulError = 'The places table has not been created yet. Please run the migration in your Supabase SQL Editor. See the console for details.';
          console.error('❌ MIGRATION NEEDED:');
          console.error('Go to: https://supabase.com/dashboard/project/_/sql/new');
          console.error('Copy and run: supabase/migrations/008_add_places_tracking.sql');
          throw new Error(helpfulError);
        }

        throw error;
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('Place added successfully:', data);

      set((state) => ({
        places: [data as Place, ...state.places],
      }));

      return data as Place;
    } catch (error) {
      console.error('Error adding place:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add place';
      set({ error: errorMessage });
      throw error;
    }
  },

  updatePlace: async (id: string, updates: PlaceUpdate) => {
    set({ error: null });
    try {
      console.log('[usePlaceStore] Updating place:', { id, updates });
      const { error } = await (supabase as any)
        .from('places')
        .update(updates)
        .eq('id', id);

      if (error) {
        console.error('Supabase error updating place:', error);
        throw error;
      }

      console.log('[usePlaceStore] Place updated successfully');

      set((state) => ({
        places: state.places.map((place) =>
          place.id === id ? { ...place, ...updates } : place
        ),
      }));

      // Refresh places with stats to reflect changes in the view
      console.log('[usePlaceStore] Refreshing placesWithStats after update');
      await get().fetchPlacesWithStats();
    } catch (error) {
      console.error('Error updating place:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update place';
      set({ error: errorMessage });
      throw error;
    }
  },

  deletePlace: async (id: string) => {
    set({ error: null });
    try {
      const { error } = await supabase
        .from('places')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting place:', error);
        throw error;
      }

      set((state) => ({
        places: state.places.filter((place) => place.id !== id),
        placesWithStats: state.placesWithStats.filter((place) => place.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting place:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete place';
      set({ error: errorMessage });
      throw error;
    }
  },

  fetchPhotoPlaces: async () => {
    set({ error: null });
    try {
      // Simple approach: just fetch all photo_places
      // RLS will automatically filter to only the current user's photos
      const { data, error } = await supabase
        .from('photo_places')
        .select('*');

      if (error) {
        console.error('Supabase error fetching photo_places:', error);
        throw error;
      }

      set({ photoPlaces: (data || []) as PhotoPlace[] });
    } catch (error) {
      console.error('Error fetching photo_places:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch photo places',
      });
    }
  },

  linkPhotoToPlace: async (link: LinkPhotoInput) => {
    set({ error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('photo_places')
        .insert(link)
        .select()
        .single();

      if (error) {
        console.error('Supabase error linking photo to place:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('Photo linked to place successfully:', data);

      set((state) => ({
        photoPlaces: [...state.photoPlaces, data as PhotoPlace],
      }));

      // Refresh places with stats to update counts
      get().fetchPlacesWithStats();

      return data as PhotoPlace;
    } catch (error) {
      console.error('Error linking photo to place:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to link photo to place';
      set({ error: errorMessage });
      throw error;
    }
  },

  unlinkPhotoFromPlace: async (photoId: string, placeId: string) => {
    set({ error: null });
    try {
      const { error } = await supabase
        .from('photo_places')
        .delete()
        .eq('photo_id', photoId)
        .eq('place_id', placeId);

      if (error) {
        console.error('Supabase error unlinking photo from place:', error);
        throw error;
      }

      set((state) => ({
        photoPlaces: state.photoPlaces.filter(
          (pp) => !(pp.photo_id === photoId && pp.place_id === placeId)
        ),
      }));

      // Refresh places with stats to update counts
      get().fetchPlacesWithStats();
    } catch (error) {
      console.error('Error unlinking photo from place:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to unlink photo from place';
      set({ error: errorMessage });
      throw error;
    }
  },

  getPlacesByPhoto: (photoId: string) => {
    const photoPlaces = get().photoPlaces.filter((pp) => pp.photo_id === photoId);
    const placeIds = photoPlaces.map((pp) => pp.place_id);
    return get().places.filter((place) => placeIds.includes(place.id));
  },

  getPhotosByPlace: (placeId: string) => {
    return get().photoPlaces
      .filter((pp) => pp.place_id === placeId)
      .map((pp) => pp.photo_id);
  },

  getPlaceWithStats: (placeId: string) => {
    return get().placesWithStats.find((place) => place.id === placeId);
  },

  // Visit management methods
  fetchPlaceVisits: async () => {
    set({ error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('place_visits')
        .select('*')
        .eq('user_id', user.id)
        .order('visit_date', { ascending: false });

      if (error) {
        console.error('Supabase error fetching place visits:', error);
        throw error;
      }

      set({ placeVisits: (data || []) as PlaceVisit[] });
    } catch (error) {
      console.error('Error fetching place visits:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch place visits',
      });
    }
  },

  addPlaceVisit: async (visit: PlaceVisitInsert) => {
    set({ error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertData = {
        ...visit,
        user_id: user.id,
      };

      const { data, error } = await (supabase as any)
        .from('place_visits')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error adding place visit:', error);
        throw error;
      }

      if (!data) throw new Error('No data returned from insert');

      set((state) => ({
        placeVisits: [...state.placeVisits, data as PlaceVisit],
      }));

      // Refresh places with stats to update counts
      get().fetchPlacesWithStats();

      return data as PlaceVisit;
    } catch (error) {
      console.error('Error adding place visit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add place visit';
      set({ error: errorMessage });
      throw error;
    }
  },

  updatePlaceVisit: async (id: string, visit: Partial<PlaceVisitInsert>) => {
    set({ error: null });
    try {
      const { error } = await (supabase as any)
        .from('place_visits')
        .update(visit)
        .eq('id', id);

      if (error) {
        console.error('Supabase error updating place visit:', error);
        throw error;
      }

      set((state) => ({
        placeVisits: state.placeVisits.map((pv) =>
          pv.id === id ? { ...pv, ...visit } : pv
        ),
      }));

      // Refresh places with stats to update counts
      get().fetchPlacesWithStats();
    } catch (error) {
      console.error('Error updating place visit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update place visit';
      set({ error: errorMessage });
      throw error;
    }
  },

  deletePlaceVisit: async (id: string) => {
    set({ error: null });
    try {
      const { error } = await (supabase as any)
        .from('place_visits')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting place visit:', error);
        throw error;
      }

      set((state) => ({
        placeVisits: state.placeVisits.filter((pv) => pv.id !== id),
      }));

      // Refresh places with stats to update counts
      get().fetchPlacesWithStats();
    } catch (error) {
      console.error('Error deleting place visit:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete place visit';
      set({ error: errorMessage });
      throw error;
    }
  },

  getVisitsByPlace: (placeId: string) => {
    return get().placeVisits
      .filter((pv) => pv.place_id === placeId)
      .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
  },
}));
