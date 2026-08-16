/**
 * FacetKey — the single action type that fills every key.
 *
 * Every key on the deck is an instance of this action. The action is deliberately "dumb": it
 * reports its grid position and device to the Controller, which decides what the key currently
 * means based on SolidWorks context. This is what lets one profile become Part tools, Sketch
 * tools, etc. — on any supported device (MK.2 5×3 or XL 8×4).
 */
import { action, type DialAction, type KeyAction, type KeyDownEvent, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { controller } from "../controller";

@action({ UUID: "com.swrobotics.facet.key" })
export class FacetKey extends SingletonAction {
	override onWillAppear(ev: WillAppearEvent): void {
		const slot = slotOf(ev.action);
		if (slot !== undefined) controller.registerKey(ev.action.device.id, slot, ev.action as KeyAction);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		controller.unregisterById(ev.action.device.id, ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const slot = slotOf(ev.action);
		if (slot !== undefined) await controller.press(ev.action.device.id, slot, ev.action as KeyAction);
	}
}

/** Resolve a key's slot index (row-major, using its device's column count) from its coordinates. */
function slotOf(a: KeyAction | DialAction): number | undefined {
	if (!a.isKey()) return undefined;
	const c = a.coordinates;
	if (!c) return undefined;
	return c.row * a.device.size.columns + c.column;
}