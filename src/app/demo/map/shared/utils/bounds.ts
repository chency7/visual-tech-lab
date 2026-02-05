import maplibregl from 'maplibre-gl';
import type { BoundsTuple } from '../types';

export function toLngLatBounds(bounds: BoundsTuple) {
  return new maplibregl.LngLatBounds(bounds[0], bounds[1]);
}