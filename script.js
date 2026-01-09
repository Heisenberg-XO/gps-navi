/**************** LOCATION DATA (BANGALORE) ****************/
const locations = {
    "Hebbal": [13.0358, 77.5970],
    "Malleshwaram": [13.0031, 77.5640],
    "Majestic": [12.9767, 77.5713],
    "KR Market": [12.9641, 77.5776],
    "Jayanagar": [12.9250, 77.5938],
    "Banashankari": [12.9255, 77.5468],
    "Silk Board": [12.9177, 77.6233],
    "Electronic City": [12.8452, 77.6600]
};

/**************** GRAPH ****************/
const graph = {
    "Hebbal": {"Malleshwaram": 7},
    "Malleshwaram": {"Hebbal": 7, "Majestic": 5},
    "Majestic": {"Malleshwaram": 5, "KR Market": 3},
    "KR Market": {"Majestic": 3, "Jayanagar": 6},
    "Jayanagar": {"KR Market": 6, "Banashankari": 4},
    "Banashankari": {"Jayanagar": 4, "Silk Board": 6},
    "Silk Board": {"Banashankari": 6, "Electronic City": 10},
    "Electronic City": {"Silk Board": 10}
};

/**************** MAP ****************/
const map = L.map("map").setView([12.9716, 77.5946], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
}).addTo(map);

/**************** ROUTING ****************/
let markers = [];
let routeLine = null;

function dijkstra(start, end) {
    let dist = {}, prev = {}, visited = [];
    for (let node in graph) dist[node] = Infinity;
    dist[start] = 0;

    while (visited.length < Object.keys(graph).length) {
        let u = null;
        for (let node in dist) {
            if (!visited.includes(node) && (u === null || dist[node] < dist[u])) {
                u = node;
            }
        }
        visited.push(u);

        for (let v in graph[u]) {
            let alt = dist[u] + graph[u][v];
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
            }
        }
    }

    let path = [end];
    while (end !== start) {
        end = prev[end];
        path.unshift(end);
    }

    return { path, distance: dist[path[path.length - 1]] };
}

function clearMap() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (routeLine) map.removeLayer(routeLine);
}

function findRoute() {
    clearMap();

    const start = document.getElementById("start").value.trim();
    const end = document.getElementById("end").value.trim();

    if (!(start in graph) || !(end in graph)) {
        document.getElementById("output").innerHTML = "❌ Invalid Location";
        return;
    }

    const result = dijkstra(start, end);

    result.path.forEach(loc => {
        markers.push(
            L.marker(locations[loc]).addTo(map).bindPopup(loc)
        );
    });

    routeLine = L.Routing.control({
        waypoints: result.path.map(l => L.latLng(...locations[l])),
        addWaypoints: false,
        draggableWaypoints: false,
        show: false,
        lineOptions: { styles: [{ color: "blue", weight: 6 }] }
    }).addTo(map);

    document.getElementById("output").innerHTML = `
        <b>Shortest Route:</b><br>${result.path.join(" → ")}<br>
        <b>Total Distance:</b> ${result.distance} km
    `;
}

/**************** LIVE TRACKING + FIREBASE ****************/

let liveMarker = null;
let watchID = null;
let pathLine = L.polyline([], { color: "red" }).addTo(map);

// Stats
let lastLat = null, lastLng = null, lastTime = null;
let startTime = null, totalDistance = 0;

// Firebase reference (created in HTML)
const trackingRef = database.ref("tracking/live");

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function startLiveTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    // Reset stats
    lastLat = lastLng = lastTime = startTime = null;
    totalDistance = 0;
    pathLine.setLatLngs([]);

    watchID = navigator.geolocation.watchPosition(
        pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const heading = pos.coords.heading ?? "N/A";
            const now = Date.now();

            if (!startTime) startTime = now;

            if (lastLat !== null) {
                totalDistance += calculateDistance(lastLat, lastLng, lat, lng);
            }

            let speed = 0;
            if (lastTime) {
                const dt = (now - lastTime) / 3600000;
                if (dt > 0) speed = totalDistance / dt;
            }

            lastLat = lat;
            lastLng = lng;
            lastTime = now;

            // 🔥 WRITE TO FIREBASE
            trackingRef.set({
                lat,
                lng,
                speed,
                distance: totalDistance,
                heading,
                timestamp: now
            });

            // Local marker
            if (!liveMarker) {
                liveMarker = L.marker([lat, lng]).addTo(map)
                    .bindPopup("📍 Live Device");
            } else {
                liveMarker.setLatLng([lat, lng]);
            }

            pathLine.addLatLng([lat, lng]);
            map.setView([lat, lng], 15);

            const elapsed = Math.floor((now - startTime) / 1000);
            const min = Math.floor(elapsed / 60);
            const sec = elapsed % 60;

            document.getElementById("output").innerHTML = `
                <b>Status:</b> Tracking Active ✅<br>
                <b>Time:</b> ${min}m ${sec}s<br>
                <b>Distance:</b> ${totalDistance.toFixed(2)} km<br>
                <b>Speed:</b> ${speed.toFixed(2)} km/h<br>
                <b>Heading:</b> ${heading}°<br>
                <b>Updated:</b> ${new Date(now).toLocaleTimeString()}
            `;
        },
        () => alert("Location permission denied"),
        { enableHighAccuracy: true }
    );
}

function stopLiveTracking() {
    if (watchID) {
        navigator.geolocation.clearWatch(watchID);
        watchID = null;
        document.getElementById("output").innerHTML = "❌ Tracking Stopped";
    }
}

/**************** FIREBASE LIVE READ (VIEWER SIDE) ****************/
trackingRef.on("value", snapshot => {
    const data = snapshot.val();
    if (!data) return;

    const { lat, lng } = data;

    if (!liveMarker) {
        liveMarker = L.marker([lat, lng]).addTo(map)
            .bindPopup("📡 Tracked Device");
    } else {
        liveMarker.setLatLng([lat, lng]);
    }
});
