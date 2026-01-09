// Location coordinates (Bangalore)
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

// Graph (distance in km)
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

// Initialize Map (Bangalore center)
const map = L.map('map').setView([12.9716, 77.5946], 11);

// OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = [];
let routeLine = null;

// Dijkstra
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

    let start = document.getElementById("start").value.trim();
    let end = document.getElementById("end").value.trim();

    if (!(start in graph) || !(end in graph)) {
        document.getElementById("output").innerHTML = "❌ Invalid Location";
        return;
    }

    let result = dijkstra(start, end);

    // Markers
    result.path.forEach(loc => {
        let marker = L.marker(locations[loc]).addTo(map).bindPopup(loc);
        markers.push(marker);
    });

    // Draw route
    let waypoints = result.path.map(loc =>
    L.latLng(locations[loc][0], locations[loc][1])
);

routeLine = L.Routing.control({
    waypoints: waypoints,
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    show: false,
    lineOptions: {
        styles: [{ color: 'blue', weight: 6 }]
    }
}).addTo(map);

    document.getElementById("output").innerHTML =
        `<b>Shortest Route:</b><br>${result.path.join(" → ")}<br><br>
         <b>Total Distance:</b> ${result.distance} km`;
}
// Live tracking marker
let liveMarker = null;

// Track phone location
function startLiveTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation not supported");
        return;
    }

    navigator.geolocation.watchPosition(
        pos => {
            let lat = pos.coords.latitude;
            let lng = pos.coords.longitude;

            if (!liveMarker) {
                liveMarker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup("📍 Live Device Location")
                    .openPopup();
            } else {
                liveMarker.setLatLng([lat, lng]);
            }

            map.setView([lat, lng], 14);
        },
        err => {
            alert("Location permission denied");
        },
        {
            enableHighAccuracy: true
        }
    );
}

