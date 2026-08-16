/** Loads the shared catalog + design tokens (bundled at build time) and resolves layouts. */
import catalogJson from "../../shared/catalog.json";
import tokensJson from "../../shared/design-tokens.json";
import type { Binding, Catalog, DeviceSpec, Layout, Tokens } from "./types";

export const catalog = catalogJson as unknown as Catalog;
export const tokens = tokensJson as unknown as Tokens;

/** Every supported device, keyed by the id reported in `ready` (e.g. "streamdeck_mk2_xl"). */
export const devices: Record<string, DeviceSpec> = catalog.meta.devices;

const DEFAULT_GRID: DeviceSpec["grid"] = { cols: 5, rows: 3, slots: 15 };

const EMPTY: Binding = { kind: "empty" };

/** Synthetic layouts shown when SolidWorks isn't connected — not user commands. */
const SYNTHETIC: Record<string, { home: string; center: Binding }> = {
	connecting: { home: "Facet", center: { kind: "info", label: "Looking for\nSolidWorks…" } },
	waiting: { home: "Facet", center: { kind: "info", label: "Start SolidWorks\nto begin" } },
};

function gridFor(deviceKey: string): DeviceSpec["grid"] {
	return devices[deviceKey]?.grid ?? DEFAULT_GRID;
}

/** The catalog key whose grid matches the given device dimensions, if any. */
export function deviceKeyForGrid(cols: number, rows: number): string | undefined {
	return Object.entries(devices).find(([, d]) => d.grid.cols === cols && d.grid.rows === rows)?.[0];
}

function synthetic(key: string, grid: DeviceSpec["grid"]): Layout {
	const spec = SYNTHETIC[key];
	const slots = Array.from({ length: grid.slots }, () => ({ ...EMPTY }));
	slots[0] = { kind: "home", label: spec.home };
	slots[centerSlot(grid)] = spec.center;
	return { title: spec.home, slots };
}

/** Visually central key of the keypad area (mirrors the old 5×3 → slot 7 choice). */
function centerSlot(grid: DeviceSpec["grid"]): number {
	const row = Math.min(grid.rows - 1, Math.floor((grid.rows - 1) / 2));
	const col = Math.floor((grid.cols - 1) / 2);
	return row * grid.cols + col;
}

/**
 * Returns a layout for a device by key with `extends` resolved (child slots override parent
 * slots), falling back to synthetic layouts and finally an all-empty grid.
 */
export function resolveLayout(deviceKey: string, key: string): Layout {
	const grid = gridFor(deviceKey);
	if (SYNTHETIC[key]) return synthetic(key, grid);

	const layout = catalog.layouts[deviceKey]?.[key];
	if (!layout) return synthetic("waiting", grid);
	if (!layout.extends) return normalize(layout, grid);

	const parent = resolveLayout(deviceKey, layout.extends);
	const slots = parent.slots.map((p, i) => layout.slots[i] ?? p);
	return normalize({ title: layout.title, slots }, grid);
}

/** Guarantees exactly grid.slots entries so the renderer can index safely. */
function normalize(layout: Layout, grid: DeviceSpec["grid"]): Layout {
	const slots = Array.from({ length: grid.slots }, (_, i) => layout.slots[i] ?? { ...EMPTY });
	return { title: layout.title, slots };
}