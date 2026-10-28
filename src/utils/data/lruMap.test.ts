import { describe, expect, it } from "vitest";
import { LRUMap } from "./lruMap";

describe("LRUMap utility", () => {
	it("initializes with default capacity and validates positive capacity", () => {
		const map = new LRUMap<string, number>(10);
		expect(map.capacity).toBe(10);
		expect(map.size).toBe(0);

		expect(() => new LRUMap(0)).toThrow(RangeError);
		expect(() => new LRUMap(-5)).toThrow(RangeError);
	});

	it("stores and retrieves items correctly", () => {
		const map = new LRUMap<string, string>(3);
		map.set("a", "1");
		map.set("b", "2");

		expect(map.get("a")).toBe("1");
		expect(map.get("b")).toBe("2");
		expect(map.get("c")).toBeUndefined();
	});

	it("evicts the least recently used item when capacity is exceeded", () => {
		const map = new LRUMap<string, number>(3);
		map.set("a", 1);
		map.set("b", 2);
		map.set("c", 3);

		expect(map.size).toBe(3);

		// Access "a", making "b" the oldest
		map.get("a");

		// Insert "d", which should evict "b"
		map.set("d", 4);

		expect(map.has("b")).toBe(false);
		expect(map.get("b")).toBeUndefined();
		expect(map.get("a")).toBe(1);
		expect(map.get("c")).toBe(3);
		expect(map.get("d")).toBe(4);
	});

	it("updates existing keys without evicting others", () => {
		const map = new LRUMap<string, number>(2);
		map.set("a", 1);
		map.set("b", 2);

		map.set("a", 100);
		expect(map.size).toBe(2);
		expect(map.get("a")).toBe(100);
		expect(map.get("b")).toBe(2);
	});
});
