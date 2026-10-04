/* Durable navigation journal. Each transaction appends points and updates metadata atomically. */
(() => {
    'use strict';
    class NavigationStore {
        constructor(name = 'speedfeet-navigation-v1') {
            this.name = name;
            this.queue = Promise.resolve();
            this.counts = new Map();
        }
        async open() {
            this.db = await new Promise((resolve, reject) => {
                const request = indexedDB.open(this.name, 1);
                request.onupgradeneeded = () => {
                    request.result.createObjectStore('state');
                    request.result.createObjectStore('points');
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                request.onblocked = () => reject(new Error('Fermez les autres fenêtres de SpeedFeet.'));
            });
            this.db.onversionchange = () => this.db.close();
        }
        run(action) {
            const job = this.queue.then(action);
            this.queue = job.catch(() => {});
            return job;
        }
        transaction(action) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(['state', 'points'], 'readwrite');
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error || new Error('Écriture interrompue'));
                tx.onabort = () => reject(tx.error || new Error('Écriture interrompue'));
                try { action(tx.objectStore('state'), tx.objectStore('points')); }
                catch (error) { tx.abort(); reject(error); }
            });
        }
        async load() {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(['state', 'points'], 'readonly');
                const values = tx.objectStore('state').getAll();
                const keys = tx.objectStore('state').getAllKeys();
                let points = [];
                const cursor = tx.objectStore('points').openCursor();
                cursor.onsuccess = () => {
                    const row = cursor.result;
                    if (row) { points.push({ key: row.key, value: row.value }); row.continue(); }
                };
                tx.oncomplete = () => {
                    const data = Object.fromEntries(keys.result.map((key, i) => [key, values.result[i]]));
                    if (data.current) {
                        data.current.track = points.filter(p => p.key[0] === data.current.id).map(p => p.value);
                        this.counts.set(data.current.id, data.current.track.length);
                    }
                    resolve(data);
                };
                tx.onerror = () => reject(tx.error || new Error('Écriture interrompue'));
                tx.onabort = () => reject(tx.error);
            });
        }
        checkpoint(navigation) {
            return this.run(async () => {
                const offset = this.counts.get(navigation.id) || 0;
                const { track, ...metadata } = navigation;
                const count = track.length;
                await this.transaction((state, points) => {
                    for (let i = offset; i < count; i++) points.put(track[i], [navigation.id, i]);
                    state.put({ ...metadata, savedAt: new Date().toISOString() }, 'current');
                });
                this.counts.set(navigation.id, count);
            });
        }
        saveHistory(history) {
            const snapshot = structuredClone(history);
            return this.run(() => this.transaction(state => state.put(snapshot, 'history')));
        }
        finalize(navigation, history) {
            const snapshot = structuredClone(history);
            return this.run(async () => {
                await this.transaction((state, points) => {
                    state.put(snapshot, 'history');
                    state.put(null, 'current');
                    points.clear();
                });
                this.counts.clear();
            });
        }
        replace(current, history) {
            const snapshot = structuredClone({ current, history });
            return this.run(async () => {
                await this.transaction((state, points) => {
                    points.clear();
                    state.put(snapshot.history, 'history');
                    if (snapshot.current) {
                        const { track, ...metadata } = snapshot.current;
                        track.forEach((point, i) => points.put(point, [metadata.id, i]));
                        state.put(metadata, 'current');
                    } else state.put(null, 'current');
                    state.put(true, 'initialized');
                });
                this.counts.clear();
                if (current) this.counts.set(current.id, current.track.length);
            });
        }
    }
    globalThis.NavigationStore = NavigationStore;
})();
