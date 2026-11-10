/**
 * Bounded LRU (Least Recently Used) Map implementation
 * 
 * Extends standard Map with a maximum capacity. When capacity is exceeded,
 * the least recently accessed/inserted entry is automatically evicted.
 */

export class LRUMap<K, V> extends Map<K, V> {
	constructor(private readonly maxCapacity: number = 50) {
		super();
		if (maxCapacity <= 0) {
			throw new RangeError("LRUMap capacity must be greater than 0");
		}
	}

	/**
	 * Retrieves an item by key and marks it as recently used.
	 */
	override get(key: K): V | undefined {
		if (!super.has(key)) return undefined;
		const value = super.get(key)!;
		// Re-insert to refresh recency in Map iteration order
		super.delete(key);
		super.set(key, value);
		return value;
	}

	/**
	 * Sets an item and evicts the oldest entry if capacity is exceeded.
	 */
	override set(key: K, value: V): this {
		if (super.has(key)) {
			super.delete(key);
		} else if (this.size >= this.maxCapacity) {
			const nextEntry = this.keys().next();
			if (!nextEntry.done) {
				this.delete(nextEntry.value);
			}
		}
		super.set(key, value);
		return this;
	}

	/**
	 * Maximum capacity of the LRU map.
	 */
	get capacity(): number {
		return this.maxCapacity;
	}
}
