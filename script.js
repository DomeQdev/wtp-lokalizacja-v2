console.log("%cŚledzenie autobusów", "background-color: black; color: #007bff; font-size: 40px; font-weight: bold;");console.log("%cby DomeQ#0001", "background-color: black; color: #00FF7E; font-size: 15px; font-weight: bold;");console.log("%c(C) DomeQ#0001 2021 - Wszelkie prawa zastrzeżone. Dane pobierana z API m.st. Warszawy.", "color: #ccc; font-size: 15px; font-weight: bold;");

var sorting = {
    type: "all",
    data: null 
}
var map = new L.Map("map").setView(localStorage.bounds?.split(",") || [52.22983095298667, 21.0117354814593], localStorage.zoom || 15);
var markers = L.layerGroup().addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

$("#modal_open").click(() => {
    $("#modal").show();
});

$("#modal_close").click(() => {
    $("#modal").hide();
});

window.onclick = (event) => event.target == document.getElementById("modal") ? $("#modal").hide() : null;

getData().then(info => info.map(x => L.marker([x.x, x.y], {
    tab: x.tab,
    type: x.type,
    icon: L.divIcon({
        className: "",
        html: renderHTML(x),
        iconSize: [renderSize(x), 100],
        popupAnchor: [0, -50]
    })
}).addTo(markers).on('click', onMarkerClick)));

const renderHTML = (x) => `<span class="vehicle-marker ${x.type}">${Date.now() - x.lastFetch > 60000 ? `<i class="fas fa-exclamation-triangle" style="color: #ff0000"></i>` : (x.deg ? `<i class="fas fa-arrow-up" style="transform: rotate(${x.deg}deg)"></i>` : '<i class="fas fa-circle"></i>')}&nbsp;<b class="line-number">${x.line}</b>${localStorage.brygady === "1" ? `<small>/${x.brigade}</small>` : ''}</span>`
const renderSize = (x) => {
    let size = 50;
    if(localStorage.brygady === "1") size += x.brigade.length * 4.2;
    if(x.line.length === 1) size -= 5;
    if(Date.now() - x.lastFetch > 60000) size += 7;
    size += x.line.length * 4;
    return size;
}

setInterval(async() => {
    let data = await getData();
    let mark = Object.values(markers._layers);
    mark.filter(x => !data.map(y => y.tab).includes(x.options.tab)).forEach(x => {
        console.log(`%c- ${x.options.type === "bus" ? "Autobus" : "Tramwaj"} ${x.options.tab} zjechał z trasy.`, "color: red; font-size: 15px; font-weight: bold;");
        markers.removeLayer(x)
    });

    data.forEach(x => {
        let t = mark.filter(y => y.options.tab === x.tab)[0];
        if(!t) return;
        t.setLatLng([x.x, x.y]);
        t.setIcon(L.divIcon({
            className: "",
            html: renderHTML(x),
            iconSize: [renderSize(x), 100],
            popupAnchor: [0, -50]
        }));
        if(t._popup && t._popup.isOpen()) map.setView(t.getLatLng(), map.getZoom());
    });

    data.filter(x => !mark.map(y => y.options.tab).includes(x.tab)).forEach(x => {
        console.log(`%c+ ${x.type === "bus" ? "Autobus" : "Tramwaj"} ${x.tab} pojawił się na trasie linii ${x.line}.`, 'color: #006b47; font-size: 15px; font-weight: bold;');
        L.marker([x.x, x.y], {
            tab: x.tab,
            type: x.type,
            icon: L.divIcon({
                className: "",
                html: renderHTML(x),
                iconSize: [renderSize(x), 100],
                popupAnchor: [0, -50]
            })
        }).addTo(markers).on('click', onMarkerClick)
    });
}, 10000);

function _fetch(url) {
    return fetch(`https://cors.domeqdev.repl.co/${url}`).then(res => res.json()).catch(() => null);
}

async function getData() {
    const data = await _fetch("realbus.pl/mapa/wtp_data.php?line_type=2");

    if(data.problem) return [];

    return data.result.map((x) => {
        return {
            "line": x.Lines,
            "type": x.Tr,
            "tab": x.Tab,
            "lastFetch": new Date(x.Time).getTime(),
            "x": x.Lat,
            "y": x.Lon,
            "deg": x.DEG,
            "brigade": x.Brigade
        }
    });
}

map.on('moveend', placeMarkersInBounds);

placeMarkersInBounds();

function placeMarkersInBounds() {
    let mapBounds = map.getBounds();
    localStorage.setItem("bounds", [map.getCenter().lat, map.getCenter().lng]);
    localStorage.setItem("zoom", map.getZoom());
    let m = Object.values(markers._layers);

    if(map.getZoom() < 15) return m.map(x => map.removeLayer(x));

    m.filter(x => x._icon && !mapBounds.contains(x.getLatLng())).map(x => map.removeLayer(x));
    m.filter(x => !x._icon && mapBounds.contains(x.getLatLng())).map(x => map.addLayer(x));    
}

async function onMarkerClick() {
    let tab = this.options.tab;
    let type = this.options.type;
    map.setView(this.getLatLng(), 17);

    let data = await _fetch(`realbus.pl/mapa/vehicle_info.php?tab=${tab}&type=${type}&info_type=json`);
    if(!data || data.problem) return this.bindPopup(`<p style="font-size: 15px;"><i class="fas fa-${type === "bus" ? "bus" : "train"}" style="color:#${type === "bus" ? "006b47" : "007bff"}"></i> <b>${tab}</b> ${type === "bus" ? "Autobus" : "Tramwaj"}</p>${this._icon?.innerHTML?.includes("fa-exclamation-triangle") ? `<i class="fas fa-exclamation-triangle" style="color: #ff0000;"></i> <b>Ten pojazd ma problemy.</b><br>` : ""}<b>Błąd!</b> Dane nie są dostępne.`).openPopup();
    let features = [];
    if(data.lowFloor === "1") features.push("Nieskopodłogowy");
    if(data.airConditioning === "1") features.push("Klimatyzacja");
    if(data.usbChargers === "1") features.push("Wejścia USB");
    if(data.ticketMachine === "1") features.push("Biletomat");    
    this.bindPopup(`<p style="font-size: 15px;"><i class="fas fa-${type === "bus" ? "bus" : "train"}" style="color:#${type === "bus" ? "006b47" : "007bff"}"></i> <b>${tab}</b> ${data.description ? data.description : type === "bus" ? "Autobus" : "Tramwaj"}</p>${this._icon?.innerHTML?.includes("fa-exclamation-triangle") ? `<i class="fas fa-exclamation-triangle" style="color: #ff0000;"></i> <b>Ten pojazd ma problemy.</b><br>` : ""}<i class="fas fa-car-side"></i> <b>${data.brand}</b> ${data.model} (${data.prodYear})<br><i class="fas fa-warehouse"></i> <b>${data.operator}</b>${data.depot ? ` (${data.depot})` : ""}<br>${features.join(', ')}`)
    this.openPopup();
}