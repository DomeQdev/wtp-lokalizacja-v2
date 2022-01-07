console.log("%cŚledzenie autobusów", "background-color: black; color: #007bff; font-size: 40px; font-weight: bold;");console.log("%cby DomeQ#0001", "background-color: black; color: #00FF7E; font-size: 15px; font-weight: bold;");console.log("%c(C) DomeQ#0001 2021 - Wszelkie prawa zastrzeżone. Dane pobierana z API m.st. Warszawy.", "color: #ccc; font-size: 15px; font-weight: bold;");

var sorting = {
    type: "all",
    data: null 
}
var map = new L.Map("map").setView(localStorage.bounds?.split(",") || [52.22983095298667, 21.0117354814593], localStorage.zoom || 15);
var markers = L.layerGroup().addTo(map);
var stops = L.layerGroup().addTo(map);
var poly = null;
var active = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

getData().then(info => info.map(x => L.marker(x.location, {
    tab: x.tab,
    type: x.type,
    trip: x.trip,
    line: x.line,
    brigade: x.brigade,
    icon: L.divIcon({
        className: "animate",
        html: renderHTML(x),
        iconSize: [renderSize(x), 27]
    })
}).addTo(markers).on('click', x.trip ? onMarkerClick : null)) && placeMarkersInBounds());

const renderHTML = (x) => `<span class="vehicle-marker ${x.type} ${!x.trip ? "blocked" : ""}">${x.deg ? `<i class="fas fa-arrow-up" style="transform: rotate(${x.deg}deg)"></i>` : '<i class="fas fa-circle"></i>'}&nbsp;<b class="line-number">${x.line}</b>${localStorage.brygady === "1" && x.type !== "metro" ? `<small>/${x.brigade}</small>` : ''}</span>`
const renderSize = (x) => {
    let size = 50;
    if(localStorage.brygady === "1" && x.type !== "metro") size += x.brigade.length * 4.2;
    if(x.line.length === 1) size -= 5;
    if(Date.now() - new Date(x.lastPing).getTime() > 60000) size += 7;
    size += x.line.length * 4;
    return size;
}

setInterval(async() => {
    let data = await getData();
    let mark = Object.values(markers._layers);
    mark.filter(x => !data.map(y => y.tab).includes(x.options.tab)).map(x => {
        console.log(`%c- ${x.options.type === "bus" ? "Autobus" : "Tramwaj"} ${x.options.tab} zjechał z trasy.`, "color: red; font-size: 15px; font-weight: bold;");
        markers.removeLayer(x);
    });

    data.map(x => {
        let t = mark.filter(y => y.options.tab === x.tab)[0];
        if(!t) return;
        t.setLatLng(x.location);
        t.setIcon(L.divIcon({
            className: "",
            html: renderHTML(x),
            iconSize: [renderSize(x), 27], 
        }));
        if(t._popup && t._popup.isOpen()) map.setView(t.getLatLng(), map.getZoom());
    });

    data.filter(x => !mark.map(y => y.options.tab).includes(x.tab)).map(x => {
        console.log(`%c+ ${x.type === "bus" ? "Autobus" : "Tramwaj"} ${x.tab} pojawił się na trasie linii ${x.line}.`, 'color: #006b47; font-size: 15px; font-weight: bold;');
        L.marker(x.location, {
            tab: x.tab,
            type: x.type,
            trip: x.trip,
            line: x.line,
            brigade: x.brigade,
            icon: L.divIcon({
                className: "",
                html: renderHTML(x),
                iconSize: [renderSize(x), 27]
            })
        }).addTo(markers).on('click', x.trip ? onMarkerClick : null)
        placeMarkersInBounds();
    });
}, 20000);

async function getData() {
    const data = await fetch("https://wtp-api.domeqalt.repl.co/location").then(res => res.json()).catch(() => null);
    if(!data) return [];

    return data;
}

map.on('moveend', placeMarkersInBounds);

placeMarkersInBounds();

function placeMarkersInBounds() {
    let mapBounds = map.getBounds();
    localStorage.setItem("bounds", [map.getCenter().lat, map.getCenter().lng]);
    localStorage.setItem("zoom", map.getZoom());
    let m = Object.values(markers._layers);

    if(map.getZoom() < 15 && !active) return m.map(x => map.removeLayer(x));

    if(active) {
        m.filter(x => x._icon && x.options.line !== active).map(x => map.removeLayer(x));
        m.filter(x => !x._icon && x.options.line === active).map(x => map.addLayer(x));
    } else {
        m.filter(x => x._icon && !mapBounds.contains(x.getLatLng())).map(x => map.removeLayer(x));
        m.filter(x => !x._icon && mapBounds.contains(x.getLatLng())).map(x => map.addLayer(x)); 
    }   
}

async function onMarkerClick() {
    console.log(this.options);
    let tab = this.options.tab;
    let type = this.options.type;
    let line = this.options.line;
    let trip = this.options.trip;

    map.setView(this.getLatLng(), 17);

    loadTrip(trip, line, type);

    /*let data = await _fetch(`realbus.pl/mapa/vehicle_info.php?tab=${tab}&type=${type}&info_type=json`);
    if(!data || data.problem) return this.bindPopup(`<p style="font-size: 15px;"><i class="fas fa-${type === "bus" ? "bus" : "train"}" style="color:#${type === "bus" ? "006b47" : "007bff"}"></i> <b>${tab}</b> ${type === "bus" ? "Autobus" : "Tramwaj"}</p>${this._icon?.innerHTML?.includes("fa-exclamation-triangle") ? `<i class="fas fa-exclamation-triangle" style="color: #ff0000;"></i> <b>Ten pojazd ma problemy.</b><br>` : ""}<b>Błąd!</b> Dane nie są dostępne.`).openPopup();
    let features = [];
    if(data.lowFloor === "1") features.push("Nieskopodłogowy");
    if(data.airConditioning === "1") features.push("Klimatyzacja");
    if(data.usbChargers === "1") features.push("Wejścia USB");
    if(data.ticketMachine === "1") features.push("Biletomat");    
    */
}

async function loadTrip(trip, line, type) {
    if(active) {
        map.removeLayer(poly);
        Object.values(stops._layers).map(x => map.removeLayer(x));
        active = null;
    }
    let data = await fetch(`https://wtp-api.domeqalt.repl.co/route?trip=${trip}`).then(res => res.json()).catch(() => null);
    
    active = line;

    poly = L.polyline(data.waypoints, {
        color: type === "bus" ? "#006b47" : "#007bff",
        opacity: 5
    }).addTo(map);

    let m = Object.values(markers._layers);
    m.filter(x => x.options.line !== line).map(x => map.removeLayer(x));

    data.stops.map(x => L.marker(x.location, {
        name: x.name,
        departure: x.departure,
        icon: L.divIcon({
            className: "",
            html: `<button class="stop_marker bg-${type}${x.on_request ? "-request" : ""}" title="${x.name} ${x.on_request ? "- Przystanek na żądanie" : ""}"><span style="position: absolute; font-size: 13px; font-weight: bold; text-align: center; margin-top: 1px;">${x.sequence}</span></button>`,
            iconSize: [20, 20],
            popupAnchor: [2, -12],
            
        })
    }).bindPopup(`<b>${x.name}</b><br>Odjazd: ${new Date(x.departure).toLocaleTimeString().split(":").slice(0,2).join(":")}`).addTo(stops));

    return data;
}
