# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parent

GIB_BOOK_ES = "/?origen=Conil%20de%20la%20Frontera&destino=Gibraltar%20/%20La%20L%C3%ADnea%20(Frontera)#calculadora"
GIB_BOOK_EN = "/en?origen=Conil%20de%20la%20Frontera&destino=Gibraltar%20/%20La%20L%C3%ADnea%20(Frontera)#calculadora"
GIB_BOOK_DE = "/de?origen=Conil%20de%20la%20Frontera&destino=Gibraltar%20/%20La%20L%C3%ADnea%20(Frontera)#calculadora"
GIB_BOOK_FR = "/fr/?origen=Conil%20de%20la%20Frontera&destino=Gibraltar%20/%20La%20L%C3%ADnea%20(Frontera)#calculadora"


def replace_many(text: str, pairs: list[tuple[str, str]]) -> str:
    for old, new in pairs:
        if old not in text:
            print("MISSING:", old[:90].replace("\n", " "))
        text = text.replace(old, new)
    return text


def patch_gibraltar_es():
    p = ROOT / "es/taxi-aeropuerto-gibraltar-conil.html"
    t = p.read_text(encoding="utf-8")
    t = t.replace("/?origen=Aeropuerto%20de%20Gibraltar#calculadora", GIB_BOOK_ES)
    t = replace_many(t, [
        ("Taxi Aeropuerto de Gibraltar a Conil | Precio Cerrado al Instante",
         "Taxi Conil al paso fronterizo de Gibraltar | Precio Cerrado"),
        ("Servicio de traslado desde el Aeropuerto de Gibraltar a Conil de La Frontera. Reserva online con tarifas fijas, conductores profesionales y vehículos premium.",
         "Traslado privado desde Conil hasta el paso transfronterizo de Gibraltar (La Línea). No recogemos dentro de Gibraltar. Precio cerrado, reserva online 24h."),
        ("Taxi Aeropuerto de Gibraltar a Conil - Servicio Premium",
         "Taxi Conil al paso fronterizo de Gibraltar - Servicio Premium"),
        ('"name": "Taxi Gibraltar a Conil - Experiencia Premium"',
         '"name": "Taxi Conil al paso fronterizo de Gibraltar"'),
        ("Servicio premium de taxi y traslado privado desde el Aeropuerto de Gibraltar (GIB) a Conil de la Frontera. Experiencia de viaje superior con conductor profesional, vehículo de lujo y atención personalizada 24h.",
         "Traslado privado desde Conil de la Frontera hasta el paso transfronterizo de Gibraltar en La Línea. No operamos recogidas dentro de Gibraltar ni en el aeropuerto GIB. Vehículo premium y precio cerrado."),
        ('"name": "Traslados Premium Aeropuerto Gibraltar"',
         '"name": "Traslados Conil al paso fronterizo de Gibraltar"'),
        ('"name": "Taxi Gibraltar a Conil - Experiencia Diurna"',
         '"name": "Taxi Conil a Gibraltar (paso fronterizo) - Diurna"'),
        ('"name": "Taxi Gibraltar a Conil - Experiencia Nocturna/Festivos"',
         '"name": "Taxi Conil a Gibraltar (paso fronterizo) - Nocturna/Festivos"'),
        ("Traslado puerta a puerta desde Aeropuerto de Gibraltar hasta Conil de la Frontera",
         "Traslado desde Conil hasta el paso transfronterizo de Gibraltar (La Línea)"),
        ("Taxi Gibraltar a Conil | Experiencia Premium - Precio cerrado y reserva 24h",
         "Taxi Conil al paso fronterizo de Gibraltar | Precio cerrado 24h"),
        ("Descubre la experiencia premium en traslados desde el Aeropuerto de Gibraltar a Conil. Vehículos de lujo, conductores profesionales y servicio personalizado 24h.",
         "Traslado desde Conil al paso transfronterizo de Gibraltar. No recogemos en Gibraltar. Vehículo premium y precio cerrado."),
        ('"name": "Taxi Aeropuerto Gibraltar"',
         '"name": "Taxi Conil a Gibraltar (paso)"'),
        ("Experiencia de Traslado Premium - Aeropuerto Gibraltar a Conil",
         "Traslado Conil al paso fronterizo de Gibraltar"),
        ('"name": "Servicio de Experiencia Aeropuerto Gibraltar"',
         '"name": "Traslado al paso fronterizo de Gibraltar"'),
        ("Experiencia completa de traslado desde el Aeropuerto de Gibraltar que incluye: recepción en terminal, gestión de equipaje, vehículo premium, conductor multilingüe, amenities a bordo y seguimiento en tiempo real.",
         "Traslado desde su dirección en Conil hasta el paso transfronterizo de Gibraltar (La Línea): recogida a domicilio, vehículo premium y dejada en el lado español de la frontera."),
        ('"name": "Aeropuerto de Gibraltar - Conil de la Frontera"',
         '"name": "Conil de la Frontera - Paso fronterizo Gibraltar (La Línea)"'),
        ('"name": "Rutas desde Aeropuerto Gibraltar"',
         '"name": "Rutas hacia el paso fronterizo de Gibraltar"'),
        ("Traslados directos desde el Aeropuerto de Gibraltar",
         "Traslados directos desde Conil hasta el paso transfronterizo de Gibraltar"),
        ('"name": "Aeropuerto Gibraltar - Conil"',
         '"name": "Conil - Paso fronterizo Gibraltar"'),
        ('"name": "Aeropuerto Gibraltar - Costa de la Luz"',
         '"name": "Costa de la Luz - Paso fronterizo Gibraltar"'),
        ("Cómo reservar su taxi del Aeropuerto de Gibraltar a Conil",
         "Cómo reservar su taxi de Conil al paso fronterizo de Gibraltar"),
        ("Use nuestra calculadora online para introducir Aeropuerto de Gibraltar (GIB) y su dirección en Conil",
         "Use nuestra calculadora online para introducir su dirección en Conil y Gibraltar / La Línea (Frontera)"),
        ('content="Aeropuerto de Gibraltar - Conil de la Frontera"',
         'content="Conil de la Frontera - Paso fronterizo Gibraltar"'),
        ("Servicio premium de aeropuerto", "Traslado al paso fronterizo"),
        ("<h1><span class=\"hero-title-top\">Taxi Aeropuerto</span> <span class=\"text-gold hero-title-bottom\">Gibraltar &rarr; Conil</span></h1>",
         "<h1><span class=\"hero-title-top\">Taxi Conil</span> <span class=\"text-gold hero-title-bottom\">&rarr; Gibraltar (paso)</span></h1>"),
        ("Especialistas en traslados exclusivos desde el Aeropuerto de Gibraltar (GIB) hasta su destino final en Conil de la Frontera.",
         "Llevamos desde Conil hasta el paso transfronterizo de Gibraltar, en La Línea. No podemos recoger dentro de Gibraltar ni en el aeropuerto GIB."),
        ("<h3>Cruce fronterizo gestionado</h3>", "<h3>Dejamos en el paso transfronterizo</h3>"),
        ("Le recogemos en el Aeropuerto de Gibraltar y le llevamos a España. Conocemos los procedimientos en la frontera y le orientamos durante el proceso.",
         "Le dejamos en el paso transfronterizo de La Línea, lo más cerca posible del acceso peatonal a Gibraltar. El cruce a pie hasta el Peñón lo realiza usted."),
        ("<h3>Recogida en terminal GIB</h3>", "<h3>No recogemos en Gibraltar</h3>"),
        ("Le esperamos en la salida del aeropuerto de Gibraltar tras su vuelo. Monitorizamos su llegada y coordinamos el punto de encuentro con antelación.",
         "Por normativa no operamos recogidas en territorio gibraltareño ni en el aeropuerto GIB. Este servicio es solo de ida: Conil (o Costa de la Luz) hacia el paso."),
        ("Para cruzar a España necesita DNI o pasaporte en vigor. Le informamos con antelación de los requisitos según su nacionalidad.",
         "Para entrar en Gibraltar necesita DNI o pasaporte en vigor. Téngalo a mano: tras la dejada en el paso, cruzará usted a pie el control fronterizo."),
        ("<h3>De Gibraltar a Conil sin preocupaciones</h3>", "<h3>De Conil al paso, sin entrar en Gibraltar</h3>"),
        ("97 km y aproximadamente 1 h 30 min hasta su hotel o apartamento en Conil. Incluye posibles esperas en frontera y gestión de equipaje en nuestro maletero de 563 litros.",
         "Unos 97–100 km y 1 h 30 min desde Conil hasta La Línea. El precio cerrado cubre hasta el paso transfronterizo, con su equipaje en nuestro maletero de 563 litros."),
        ("Tarifas calculadas para trayectos directos Aeropuerto de Gibraltar &rarr; Conil Centro.",
         "Tarifas orientativas Conil Centro &rarr; paso transfronterizo de Gibraltar (La Línea). El precio exacto se calcula en la reserva."),
        ("Complete los Datos</h3>\n                        <p>Facilítenos los detalles de su vuelo y contacto. Sin registros complicados ni esperas innecesarias.</p>",
         "Complete los Datos</h3>\n                        <p>Indique su dirección de recogida en Conil o Roche y la hora a la que debe estar en el paso. Sin registros complicados.</p>"),
        ("Su Protocolo de <br><span class=\"text-gold\">Bienvenida en GIB</span>",
         "Su protocolo de <br><span class=\"text-gold\">llegada al paso</span>"),
        ("Llegada sin estrés", "Salida sin estrés"),
        ("<h5>Recogida en GIB</h5>", "<h5>Recogida en Conil</h5>"),
        ("Le esperamos en la salida del aeropuerto de Gibraltar tras su vuelo. Monitorizamos su llegada en tiempo real.",
         "Le recogemos en su hotel, villa o dirección en Conil (o urbanizaciones como Roche) a la hora acordada."),
        ("<h5>Cruce de frontera</h5>", "<h5>Llegada al paso transfronterizo</h5>"),
        ("Cruzamos la frontera hacia España. Tenga su DNI o pasaporte a mano. Le orientamos durante el proceso según las condiciones del día.",
         "Le dejamos en el lado español del paso (La Línea), junto al acceso peatonal. No cruzamos el vehículo hacia Gibraltar."),
        ("<h5>Llegada a Conil</h5>", "<h5>Cruce a pie hacia Gibraltar</h5>"),
        ("Le llevamos directamente a su hotel, villa o apartamento en Conil. El precio incluye el trayecto completo desde Gibraltar.",
         "Usted continúa a pie por el paso hacia Gibraltar o el aeropuerto GIB. El precio incluye solo hasta el punto de dejada en frontera."),
        ("¿Qué documentación necesito para cruzar la frontera?",
         "¿Pueden recogerme en Gibraltar o en el aeropuerto GIB?"),
        ("Para entrar en España desde Gibraltar necesita DNI o pasaporte en vigor. Los ciudadanos de la UE pueden usar su documento nacional de identidad. Le informamos con antelación según su nacionalidad.",
         "No. No podemos recoger en Gibraltar ni en el aeropuerto GIB. El servicio es únicamente de ida desde Conil (y zona) hasta el paso transfronterizo en La Línea."),
        ("¿Qué ocurre si hay cola en la frontera?",
         "¿Dónde me dejan exactamente?"),
        ("Las esperas en la frontera pueden variar según la hora y el día. Nuestro precio cerrado incluye el trayecto completo desde el aeropuerto de Gibraltar hasta Conil. Le mantenemos informado durante el proceso.",
         "En el paso transfronterizo de La Línea, en el lado español, lo más cerca posible del acceso peatonal a Gibraltar. No entramos con el taxi en territorio gibraltareño."),
        ("¿Dónde me recogen en el aeropuerto de Gibraltar?",
         "¿Qué documentación necesito para entrar en Gibraltar?"),
        ("Le esperamos en la salida del aeropuerto tras recoger su equipaje. Coordinamos el punto de encuentro con antelación para facilitar su localización.",
         "DNI o pasaporte en vigor. Los ciudadanos de la UE pueden usar su documento nacional de identidad. El control lo realiza usted a pie tras bajar del taxi."),
        ("¿El servicio es puerta a puerta?",
         "¿El servicio es puerta a puerta hasta Gibraltar?"),
        ("Absolutamente. Le recogemos en la terminal y le dejamos exactamente en la puerta de su hotel, villa o residencia en Conil, sin transbordos ni caminatas.",
         "Recogemos en la puerta de su alojamiento en Conil o Roche y le dejamos en el paso. El tramo peatonal de la frontera hasta Gibraltar o GIB lo hace usted."),
        ("¿Qué ocurre si el avión aterriza tarde?",
         "¿Y si hay cola en la frontera después de bajarme?"),
        ("No se preocupe. Usamos el número de vuelo para monitorizar el estado real del mismo. Si hay un retraso, ajustamos la hora de recogida automáticamente y le esperamos sin costes adicionales.",
         "Las colas en el paso varían según hora y día. Nuestro tiempo y precio cubren el trayecto hasta la dejada en La Línea; el tiempo de cruce peatonal no está incluido."),
        ("Información: Traslado Aeropuerto de Gibraltar",
         "Información: Traslado al paso fronterizo de Gibraltar"),
        ("Traslado aeropuerto de Gibraltar (GIB)",
         "Traslado al paso fronterizo de Gibraltar"),
        ('"text": "Nos pondremos en contacto con usted previamente para acordar un punto de encuentro exacto y facilitar su localización una vez aterrice. No es necesario buscar paradas externas."',
         '"text": "Le recogemos en su dirección en Conil o Roche y le dejamos en el paso transfronterizo de La Línea. No recogemos en Gibraltar ni en GIB."'),
        ('"text": "Absolutamente. Le recogemos en la terminal y le dejamos exactamente en la puerta de su hotel, villa o residencia en Conil, sin transbordos ni caminatas."',
         '"text": "Le recogemos en su alojamiento en Conil y le dejamos en el paso transfronterizo. El cruce peatonal hacia Gibraltar lo realiza usted."'),
        ('"text": "No se preocupe. Usamos el número de vuelo para monitorizar el estado real del mismo. Si hay un retraso, ajustamos la hora de recogida automáticamente y le esperamos sin costes adicionales."',
         '"text": "Reserve con margen respecto a su vuelo o cita en Gibraltar. El tiempo de cola peatonal en el paso no forma parte del trayecto en taxi."'),
        ('"name": "¿Dónde me espera exactamente el conductor?"',
         '"name": "¿Dónde me deja el conductor?"'),
        ('"name": "¿El servicio es puerta a puerta?"',
         '"name": "¿Llegan hasta dentro de Gibraltar?"'),
        ('"name": "¿Qué ocurre si el avión aterriza tarde?"',
         '"name": "¿Recogen en el aeropuerto de Gibraltar?"'),
    ])
    p.write_text(t, encoding="utf-8")
    print("patched ES gibraltar")


def patch_gibraltar_en():
    p = ROOT / "en/taxi-aeropuerto-gibraltar-conil.html"
    t = p.read_text(encoding="utf-8")
    t = t.replace("/en?origen=Gibraltar%20Airport#calculadora", GIB_BOOK_EN)
    t = replace_many(t, [
        ("Taxi Gibraltar to Conil | Premium Experience & Fixed Price 24/7",
         "Taxi Conil to Gibraltar border crossing | Fixed price"),
        ("Premium transfer experience from Gibraltar Airport (GIB) to Conil. Luxury vehicle, professional driver, and personalized 24/7 service with fixed pricing.",
         "Private transfer from Conil to the Gibraltar border crossing at La Línea. We cannot pick up inside Gibraltar or at GIB airport. Fixed price, 24/7 booking."),
        ("Taxi Gibraltar Airport to Conil | Fixed Price Instantly",
         "Taxi Conil to Gibraltar border crossing | Fixed price"),
        ("Transfer service from Gibraltar Airport to Conil de La Frontera. Online booking with fixed rates, professional drivers and premium vehicles.",
         "Private transfer from Conil to the Gibraltar border crossing (La Línea). Drop-off on the Spanish side only. No pick-ups in Gibraltar."),
        ("Taxi Gibraltar Airport to Conil - Premium Service",
         "Taxi Conil to Gibraltar border crossing - Premium service"),
        ("VIP Airport Service", "Border-crossing transfer"),
        ("<h1><span class=\"hero-title-top\">Airport Taxi</span> <span class=\"text-gold hero-title-bottom\">Gibraltar &rarr; Conil</span></h1>",
         "<h1><span class=\"hero-title-top\">Taxi Conil</span> <span class=\"text-gold hero-title-bottom\">&rarr; Gibraltar (border)</span></h1>"),
        ("Specialists in exclusive transfers from Gibraltar Airport (GIB) to your final destination in Conil de la Frontera.",
         "We drive from Conil to the Gibraltar border crossing in La Línea. We cannot collect inside Gibraltar or at GIB airport."),
        ("<h3>Managed border crossing</h3>", "<h3>Drop-off at the border crossing</h3>"),
        ("We pick you up at Gibraltar Airport and take you into Spain. We know border procedures and guide you through the process.",
         "We drop you at the La Línea border crossing, as close as possible to the pedestrian access into Gibraltar. You complete the crossing on foot."),
        ("<h3>Pickup at GIB terminal</h3>", "<h3>No pick-up in Gibraltar</h3>"),
        ("We wait for you at Gibraltar Airport exit after your flight. We monitor your arrival and coordinate the meeting point in advance.",
         "We do not operate pick-ups on Gibraltar territory or at GIB airport. This service is outbound only: Conil (or Costa de la Luz) to the border."),
        ("To enter Spain you need a valid ID card or passport. We inform you in advance of the requirements according to your nationality.",
         "To enter Gibraltar you need a valid ID card or passport. Keep it ready: after drop-off you walk through the border control yourself."),
        ("<h3>From Gibraltar to Conil worry-free</h3>", "<h3>From Conil to the border, without entering Gibraltar</h3>"),
        ("97 km and approximately 1 h 30 min to your hotel or apartment in Conil. Includes possible border waits and luggage handling in our 563-litre trunk.",
         "About 97–100 km and 1 h 30 min from Conil to La Línea. The fixed fare covers the journey to the border crossing, with luggage in our 563-litre boot."),
        ("Fares calculated for direct trips Gibraltar Airport &rarr; Conil Centre.",
         "Guide fares for Conil Centre &rarr; Gibraltar border crossing (La Línea). Exact price is calculated at booking."),
        ("What documentation do I need to cross the border?",
         "Can you pick me up in Gibraltar or at GIB airport?"),
        ("To enter Spain from Gibraltar you need a valid ID card or passport. EU citizens can use their national identity document. We inform you in advance according to your nationality.",
         "No. We cannot pick up in Gibraltar or at GIB airport. The service is outbound only, from Conil (and nearby) to the border crossing in La Línea."),
        ("What happens if there is a queue at the border?",
         "Where exactly do you drop me off?"),
        ("Border waits can vary depending on the time and day. Our fixed price includes the complete journey from Gibraltar Airport to Conil. We keep you informed throughout the process.",
         "At the La Línea border crossing, on the Spanish side, as close as possible to the pedestrian access into Gibraltar. The taxi does not enter Gibraltar."),
        ("Where will you pick me up at Gibraltar Airport?",
         "What documents do I need to enter Gibraltar?"),
        ("We wait for you at the airport exit after you collect your luggage. We coordinate the meeting point in advance to make finding us easy.",
         "A valid ID card or passport. EU citizens may use their national identity document. You complete border control on foot after leaving the taxi."),
        ("Is the service door-to-door?",
         "Is it door-to-door all the way into Gibraltar?"),
        ("Absolutely. We pick you up at the terminal and drop you right at the door of your hotel, villa or residence in Conil, with no transfers or walking.",
         "We collect you at your Conil or Roche address and drop you at the border. The pedestrian crossing into Gibraltar or GIB is yours to complete."),
        ("What happens if the flight lands late?",
         "What if there is a queue at the border after I get out?"),
        ("Don't worry. We use your flight number to monitor the real-time status. If there is a delay, we automatically adjust the pick-up time and wait at no extra cost.",
         "Queues vary by time of day. Our time and fare cover the drive to drop-off in La Línea; pedestrian crossing time is not included."),
        ("Gibraltar Airport transfer (GIB)", "Transfer to the Gibraltar border crossing"),
    ])
    # Protocol section EN
    t = t.replace("Welcome protocol at GIB", "Arrival protocol at the border")
    t = t.replace("Pickup at GIB", "Pick-up in Conil")
    t = t.replace("We wait for you at Gibraltar Airport exit after your flight. We monitor your arrival in real time.",
                  "We collect you at your hotel, villa or address in Conil (or Roche) at the agreed time.")
    t = t.replace("We cross the border into Spain. Have your ID or passport ready. We guide you through the process according to the day's conditions.",
                  "We drop you on the Spanish side of the crossing (La Línea), by the pedestrian access. The vehicle does not enter Gibraltar.")
    t = t.replace("We take you directly to your hotel, villa or apartment in Conil. The price includes the full journey from Gibraltar.",
                  "You continue on foot through the crossing into Gibraltar or GIB. The fare covers only up to the border drop-off.")
    p.write_text(t, encoding="utf-8")
    print("patched EN gibraltar")


def patch_gibraltar_de():
    p = ROOT / "de/taxi-aeropuerto-gibraltar-conil.html"
    t = p.read_text(encoding="utf-8")
    t = t.replace("/de?origen=Flughafen%20Gibraltar#calculadora", GIB_BOOK_DE)
    t = replace_many(t, [
        ("Taxi Flughafen Gibraltar nach Conil | Festpreis Sofort",
         "Taxi Conil zum Grenzübergang Gibraltar | Festpreis"),
        ("Transferservice vom Flughafen Gibraltar nach Conil de La Frontera. Online-Buchung mit Festpreisen, professionellen Fahrern und Premium-Fahrzeugen.",
         "Privater Transfer von Conil zum Grenzübergang Gibraltar in La Línea. Keine Abholung in Gibraltar oder am Flughafen GIB. Festpreis, Online-Buchung."),
        ("Taxi Flughafen Gibraltar nach Conil - Premium-Service",
         "Taxi Conil zum Grenzübergang Gibraltar - Premium-Service"),
        ("VIP Flughafen-Service", "Transfer zum Grenzübergang"),
        ("<h1><span class=\"hero-title-top\">Flughafen-Taxi</span> <span class=\"text-gold hero-title-bottom\">Gibraltar &rarr; Conil</span></h1>",
         "<h1><span class=\"hero-title-top\">Taxi Conil</span> <span class=\"text-gold hero-title-bottom\">&rarr; Gibraltar (Grenze)</span></h1>"),
        ("Spezialisten für exklusive Transfers vom Flughafen Gibraltar (GIB) zu Ihrem Ziel in Conil de la Frontera.",
         "Wir fahren von Conil zum Grenzübergang Gibraltar in La Línea. Eine Abholung in Gibraltar oder am Flughafen GIB ist nicht möglich."),
        ("Wir holen Sie am Flughafen Gibraltar ab und bringen Sie nach Spanien. Wir kennen die Grenzverfahren und begleiten Sie durch den Prozess.",
         "Wir setzen Sie am Grenzübergang in La Línea ab, so nah wie möglich am Fußgängerzugang nach Gibraltar. Den Grenzübertritt gehen Sie selbst."),
        ("<h3>Abholung am GIB-Terminal</h3>", "<h3>Keine Abholung in Gibraltar</h3>"),
        ("Wir erwarten Sie am Ausgang des Flughafens Gibraltar nach Ihrem Flug. Wir überwachen Ihre Ankunft und koordinieren den Treffpunkt im Voraus.",
         "Wir holen in Gibraltar und am Flughafen GIB nicht ab. Dieser Service ist nur in eine Richtung: von Conil (Costa de la Luz) zum Grenzübergang."),
        ("<h3>Von Gibraltar nach Conil ohne Sorgen</h3>", "<h3>Von Conil zur Grenze, ohne Einfahrt nach Gibraltar</h3>"),
        ("Transfer Flughafen Gibraltar (GIB)", "Transfer zum Grenzübergang Gibraltar"),
    ])
    p.write_text(t, encoding="utf-8")
    print("patched DE gibraltar")


def patch_gibraltar_fr():
    p = ROOT / "fr/taxi-aeropuerto-gibraltar-conil.html"
    t = p.read_text(encoding="utf-8")
    t = t.replace("/fr/?origen=A%C3%A9roport%20de%20Gibraltar#calculadora", GIB_BOOK_FR)
    t = replace_many(t, [
        ("Taxi de l'Aéroport de Gibraltar vers Conil | Expérience Premium & Tarif Fixe 24h/24",
         "Taxi Conil vers le passage frontalier de Gibraltar | Tarif fixe"),
        ("Expérience de transfert premium de l'Aéroport de Gibraltar (GIB) à Conil. Véhicule de luxe, chauffeur professionnel et service personnalisé 24h/24 avec tarif fixe.",
         "Transfert privé de Conil jusqu'au passage frontalier de Gibraltar à La Línea. Pas de prise en charge à Gibraltar ni à GIB. Tarif fixe, réservation 24h/24."),
        ("Taxi Aéroport de Gibraltar à Conil | Prix Fixe Instantané",
         "Taxi Conil vers le passage frontalier de Gibraltar | Prix fixe"),
        ("Service de transfert de l'Aéroport de Gibraltar à Conil de La Frontera. Réservation en ligne avec tarifs fixes, chauffeurs professionnels et véhicules premium.",
         "Transfert privé de Conil jusqu'au passage frontalier (La Línea). Dépôt côté espagnol uniquement. Pas de prise en charge à Gibraltar."),
        ("Taxi Aéroport de Gibraltar à Conil - Service Premium",
         "Taxi Conil vers le passage frontalier de Gibraltar - Service premium"),
        ("Service aéroport VIP", "Transfert vers le passage frontalier"),
        ("<h1><span class=\"hero-title-top\">Taxi aéroport</span> <span class=\"text-gold hero-title-bottom\">Gibraltar &rarr; Conil</span></h1>",
         "<h1><span class=\"hero-title-top\">Taxi Conil</span> <span class=\"text-gold hero-title-bottom\">&rarr; Gibraltar (passage)</span></h1>"),
        ("Spécialistes des transferts privés depuis l'Aéroport de Gibraltar (GIB) jusqu'à votre destination à Conil de la Frontera.",
         "Nous vous conduisons de Conil jusqu'au passage frontalier de Gibraltar à La Línea. Nous ne pouvons pas vous prendre en charge à Gibraltar ni à GIB."),
        ("Nous vous récupérons à l'aéroport de Gibraltar et vous conduisons en Espagne. Nous connaissons les procédures frontalières et vous guidons tout au long du processus.",
         "Nous vous déposons au passage frontalier de La Línea, au plus près de l'accès piéton vers Gibraltar. Vous franchissez la frontière à pied."),
        ("Transfert aéroport de Gibraltar (GIB)", "Transfert vers le passage frontalier de Gibraltar"),
    ])
    p.write_text(t, encoding="utf-8")
    print("patched FR gibraltar")


ROCHE = {
    "jerez": {
        "src": "taxi-aeropuerto-jerez-conil",
        "slug": "taxi-roche-aeropuerto-jerez",
        "dest_es": "Jerez (aeropuerto XRY)",
        "dest_q": "Jerez%20(aeropuerto%20XRY)",
        "km": "65 KM",
        "time_es": "45 MIN",
        "via": "A-48",
        "p1": "90",
        "p2": "104",
        "title_es": "Taxi Roche al Aeropuerto de Jerez | Precio Cerrado",
        "desc_es": "Traslado privado desde urbanización Roche (Conil) al Aeropuerto de Jerez (XRY). Recogida a domicilio, tarifa fija y reserva online.",
        "h1_top": "Taxi Roche",
        "h1_bot": "&rarr; Aeropuerto Jerez",
        "tag": "Traslado desde Roche",
        "intro": "Especialistas en traslados desde urbanización Roche hasta el Aeropuerto de Jerez (XRY). Recogida en su villa o apartamento y dejada en terminal.",
        "card1_h": "Recogida en Roche",
        "card1_p": "Le recogemos en su dirección de urbanización Roche, Conil de la Frontera. Indique calle y número al reservar para una llegada puntual a la puerta.",
        "card2_h": "Llegada a terminal XRY",
        "card2_p": "Le dejamos en la terminal del Aeropuerto de Jerez con tiempo para facturar. El conductor le ayuda con el equipaje hasta la zona de salidas.",
        "card3_h": "Seguridad infantil",
        "card3_p": "Disponemos de Sistemas de Retención Infantil (SRI) homologados para todas las edades, disponibles bajo petición previa.",
        "card4_h": "Roche–Jerez sin transbordos",
        "card4_p": "Unos 65 km y 45 min por la A-48. Trayecto directo desde Roche hasta XRY, con maletero de 563 litros para su equipaje.",
        "fare_note": "Tarifas orientativas Roche &rarr; Aeropuerto de Jerez. El precio exacto se calcula con su dirección concreta.",
        "proto_tag": "Salida sin estrés",
        "proto_h": "Protocolo de <br><span class=\"text-gold\">salida desde Roche</span>",
        "s1h": "Recogida en Roche",
        "s1p": "Confirmamos su dirección en urbanización Roche y la hora de salida para llegar a XRY con margen de facturación.",
        "s2h": "Ruta directa A-48",
        "s2p": "Salimos de Roche hacia el aeropuerto de Jerez por vía rápida, evitando rodeos innecesarios.",
        "s3h": "Dejada en terminal",
        "s3p": "Le acompañamos a la zona de salidas del Aeropuerto de Jerez y le ayudamos con las maletas.",
        "faq_q1": "¿Cuánto tarda el trayecto de Roche al Aeropuerto de Jerez?",
        "faq_a1": "Aproximadamente 45 minutos (unos 65 km) según tráfico. Recogemos en Roche y le dejamos en la terminal XRY.",
        "faq_q2": "¿Dónde me recogen en Roche?",
        "faq_a2": "En la puerta de su villa, apartamento o dirección exacta en urbanización Roche. Indíquela al reservar.",
        "faq_q3": "¿El servicio es solo desde Roche hacia Jerez?",
        "faq_a3": "Esta página está pensada para traslados desde Roche al aeropuerto. También puede reservar el sentido contrario o Conil centro en la calculadora.",
        "other_a_slug": "taxi-roche-aeropuerto-sevilla",
        "other_a_label": "Roche &rarr; Sevilla (SVQ)",
        "other_a_p": "Traslado directo desde Roche al Aeropuerto de Sevilla-San Pablo.",
        "other_b_slug": "taxi-roche-aeropuerto-malaga",
        "other_b_label": "Roche &rarr; Málaga (AGP)",
        "other_b_p": "Traslado desde Roche al Aeropuerto de Málaga-Costa del Sol.",
        "title_en": "Taxi Roche to Jerez Airport | Fixed price",
        "desc_en": "Private transfer from Roche (Conil) to Jerez Airport (XRY). Door pickup, fixed fare, online booking.",
        "h1_en": ("Taxi Roche", "&rarr; Jerez Airport"),
        "title_de": "Taxi Roche zum Flughafen Jerez | Festpreis",
        "desc_de": "Privater Transfer von der Urbanisation Roche (Conil) zum Flughafen Jerez (XRY). Abholung an der Tür, Festpreis.",
        "h1_de": ("Taxi Roche", "&rarr; Flughafen Jerez"),
        "title_fr": "Taxi Roche vers l'aéroport de Jerez | Tarif fixe",
        "desc_fr": "Transfert privé de l'urbanisation Roche (Conil) vers l'aéroport de Jerez (XRY). Prise en charge à domicile, tarif fixe.",
        "h1_fr": ("Taxi Roche", "&rarr; Aéroport de Jerez"),
    },
    "sevilla": {
        "src": "taxi-aeropuerto-sevilla-conil",
        "slug": "taxi-roche-aeropuerto-sevilla",
        "dest_es": "Sevilla (aeropuerto SVQ)",
        "dest_q": "Sevilla%20(aeropuerto%20SVQ)",
        "km": "150 KM",
        "time_es": "1H 30",
        "via": "AP-4",
        "p1": "214",
        "p2": "246",
        "title_es": "Taxi Roche al Aeropuerto de Sevilla | Precio Cerrado",
        "desc_es": "Traslado privado desde urbanización Roche (Conil) al Aeropuerto de Sevilla (SVQ). Recogida a domicilio y tarifa fija.",
        "h1_top": "Taxi Roche",
        "h1_bot": "&rarr; Aeropuerto Sevilla",
        "tag": "Traslado desde Roche",
        "intro": "Especialistas en traslados desde urbanización Roche hasta el Aeropuerto de Sevilla (SVQ). Recogida en su vivienda y dejada en terminal.",
        "card1_h": "Recogida en Roche",
        "card1_p": "Le recogemos en su dirección de urbanización Roche. Ideal si viaja desde villa o apartamento y no quiere desplazarse a Conil centro.",
        "card2_h": "Llegada a SVQ",
        "card2_p": "Le dejamos en la terminal del Aeropuerto de Sevilla-San Pablo con margen para facturar vuelos nacionales e internacionales.",
        "card3_h": "Seguridad infantil",
        "card3_p": "Disponemos de Sistemas de Retención Infantil homologados, bajo petición previa.",
        "card4_h": "Roche–Sevilla directo",
        "card4_p": "Unos 150 km y 1 h 30 min por AP-4. Trayecto privado desde Roche hasta SVQ, equipaje incluido.",
        "fare_note": "Tarifas orientativas Roche &rarr; Aeropuerto de Sevilla. El precio exacto se calcula con su dirección.",
        "proto_tag": "Salida sin estrés",
        "proto_h": "Protocolo de <br><span class=\"text-gold\">salida desde Roche</span>",
        "s1h": "Recogida en Roche",
        "s1p": "Confirmamos dirección y hora de salida para llegar a SVQ con tiempo de facturación.",
        "s2h": "Autovía AP-4",
        "s2p": "Ruta directa hacia Sevilla, evitando transbordos y transbordos de tren.",
        "s3h": "Dejada en terminal",
        "s3p": "Le dejamos en la terminal de San Pablo y le ayudamos con el equipaje.",
        "faq_q1": "¿Cuánto tarda Roche al Aeropuerto de Sevilla?",
        "faq_a1": "Aproximadamente 1 h 30 min (unos 150 km) según tráfico.",
        "faq_q2": "¿Dónde me recogen en Roche?",
        "faq_a2": "En la puerta de su vivienda en urbanización Roche. Indique la dirección exacta al reservar.",
        "faq_q3": "¿Puedo ir también a Santa Justa?",
        "faq_a3": "Sí. Reserve en la calculadora el destino estación Santa Justa o solicite un presupuesto para Sevilla centro.",
        "other_a_slug": "taxi-roche-aeropuerto-jerez",
        "other_a_label": "Roche &rarr; Jerez (XRY)",
        "other_a_p": "Traslado más corto desde Roche al Aeropuerto de Jerez.",
        "other_b_slug": "taxi-roche-aeropuerto-malaga",
        "other_b_label": "Roche &rarr; Málaga (AGP)",
        "other_b_p": "Traslado desde Roche al Aeropuerto de Málaga.",
        "title_en": "Taxi Roche to Seville Airport | Fixed price",
        "desc_en": "Private transfer from Roche (Conil) to Seville Airport (SVQ). Door pickup and fixed fare.",
        "h1_en": ("Taxi Roche", "&rarr; Seville Airport"),
        "title_de": "Taxi Roche zum Flughafen Sevilla | Festpreis",
        "desc_de": "Privater Transfer von Roche (Conil) zum Flughafen Sevilla (SVQ).",
        "h1_de": ("Taxi Roche", "&rarr; Flughafen Sevilla"),
        "title_fr": "Taxi Roche vers l'aéroport de Séville | Tarif fixe",
        "desc_fr": "Transfert privé de Roche (Conil) vers l'aéroport de Séville (SVQ).",
        "h1_fr": ("Taxi Roche", "&rarr; Aéroport de Séville"),
    },
    "malaga": {
        "src": "taxi-aeropuerto-malaga-conil",
        "slug": "taxi-roche-aeropuerto-malaga",
        "dest_es": "Málaga (aeropuerto AGP)",
        "dest_q": "M%C3%A1laga%20(aeropuerto%20AGP)",
        "km": "200 KM",
        "time_es": "2H 05",
        "via": "AP-7/A-7",
        "p1": "286",
        "p2": "334",
        "title_es": "Taxi Roche al Aeropuerto de Málaga | Precio Cerrado",
        "desc_es": "Traslado privado desde urbanización Roche (Conil) al Aeropuerto de Málaga (AGP). Recogida a domicilio y tarifa fija.",
        "h1_top": "Taxi Roche",
        "h1_bot": "&rarr; Aeropuerto Málaga",
        "tag": "Traslado desde Roche",
        "intro": "Especialistas en traslados de larga distancia desde Roche hasta el Aeropuerto de Málaga-Costa del Sol (AGP).",
        "card1_h": "Recogida en Roche",
        "card1_p": "Salida desde su villa o apartamento en urbanización Roche, sin desplazarse al centro de Conil.",
        "card2_h": "Llegada a AGP",
        "card2_p": "Le dejamos en la terminal del Aeropuerto de Málaga con margen para facturar, incluido vuelos internacionales.",
        "card3_h": "Confort en trayecto largo",
        "card3_p": "Volkswagen Arteon, climatización y maletero de 563 litros para un viaje de unas 2 horas con total comodidad.",
        "card4_h": "Roche–Málaga directo",
        "card4_p": "Unos 200 km y 2 h 05 min. Precio cerrado por vehículo privado, no por persona.",
        "fare_note": "Tarifas orientativas Roche &rarr; Aeropuerto de Málaga. Calcule el precio exacto con su dirección.",
        "proto_tag": "Salida sin estrés",
        "proto_h": "Protocolo de <br><span class=\"text-gold\">salida desde Roche</span>",
        "s1h": "Recogida en Roche",
        "s1p": "Ajustamos la hora de salida a su vuelo desde Málaga, con margen de facturación.",
        "s2h": "Autovía hacia Málaga",
        "s2p": "Ruta por A-48 y AP-7/A-7 hasta el aeropuerto, sin transbordos.",
        "s3h": "Dejada en terminal",
        "s3p": "Le dejamos en AGP y le ayudamos con el equipaje en salidas.",
        "faq_q1": "¿Cuánto tarda Roche al Aeropuerto de Málaga?",
        "faq_a1": "Aproximadamente 2 h 05 min (unos 200 km), según tráfico y peajes.",
        "faq_q2": "¿Dónde me recogen en Roche?",
        "faq_a2": "En su dirección exacta de urbanización Roche. Facilítela al reservar.",
        "faq_q3": "¿El precio incluye peajes?",
        "faq_a3": "Sí. El precio cerrado incluye peajes habituales del recorrido y el equipaje razonable.",
        "other_a_slug": "taxi-roche-aeropuerto-jerez",
        "other_a_label": "Roche &rarr; Jerez (XRY)",
        "other_a_p": "La opción más corta desde Roche hacia aeropuerto.",
        "other_b_slug": "taxi-roche-aeropuerto-sevilla",
        "other_b_label": "Roche &rarr; Sevilla (SVQ)",
        "other_b_p": "Traslado desde Roche al Aeropuerto de Sevilla.",
        "title_en": "Taxi Roche to Malaga Airport | Fixed price",
        "desc_en": "Private transfer from Roche (Conil) to Malaga Airport (AGP). Door pickup, fixed fare.",
        "h1_en": ("Taxi Roche", "&rarr; Malaga Airport"),
        "title_de": "Taxi Roche zum Flughafen Malaga | Festpreis",
        "desc_de": "Privater Transfer von Roche (Conil) zum Flughafen Malaga (AGP).",
        "h1_de": ("Taxi Roche", "&rarr; Flughafen Malaga"),
        "title_fr": "Taxi Roche vers l'aéroport de Malaga | Tarif fixe",
        "desc_fr": "Transfert privé de Roche (Conil) vers l'aéroport de Malaga (AGP).",
        "h1_fr": ("Taxi Roche", "&rarr; Aéroport de Malaga"),
    },
    "bahia": {
        "src": "taxi-bahia-sur-conil",
        "slug": "taxi-roche-bahia-sur",
        "dest_es": "San Fernando (Bahía Sur)",
        "dest_q": "San%20Fernando%20(Bah%C3%ADa%20Sur)",
        "km": "28 KM",
        "time_es": "25 MIN",
        "via": "A-48",
        "p1": "40",
        "p2": "46",
        "title_es": "Taxi Roche a Bahía Sur | Precio Cerrado",
        "desc_es": "Traslado privado desde urbanización Roche a la estación de tren San Fernando-Bahía Sur. Recogida a domicilio y tarifa fija.",
        "h1_top": "Taxi Roche",
        "h1_bot": "&rarr; Bahía Sur",
        "tag": "Traslado desde Roche",
        "intro": "Traslado desde urbanización Roche hasta la estación de tren San Fernando-Bahía Sur. Recogida en su vivienda y dejada en el acceso a andenes.",
        "card1_h": "Recogida en Roche",
        "card1_p": "Le recogemos en su dirección de Roche. Más corto que salir desde el centro de Conil hacia Bahía Sur.",
        "card2_h": "Estación Bahía Sur",
        "card2_p": "Le dejamos en San Fernando-Bahía Sur con tiempo para su tren (Cádiz, Sevilla, Madrid, etc.).",
        "card3_h": "Equipaje incluido",
        "card3_p": "Maletero de 563 litros. Ayuda con maletas hasta el acceso de la estación.",
        "card4_h": "Roche–Bahía Sur en 25 min",
        "card4_p": "Unos 28 km por la A-48. Precio cerrado por vehículo privado.",
        "fare_note": "Tarifas orientativas Roche &rarr; estación Bahía Sur. Calcule el precio exacto con su dirección.",
        "proto_tag": "Salida puntual",
        "proto_h": "Protocolo de <br><span class=\"text-gold\">llegada a Bahía Sur</span>",
        "s1h": "Recogida en Roche",
        "s1p": "Ajustamos la hora a su tren desde Bahía Sur, con margen de acceso a andenes.",
        "s2h": "A-48 hacia San Fernando",
        "s2p": "Ruta directa desde Roche, más corta que desde Conil centro.",
        "s3h": "Dejada en estación",
        "s3p": "Le dejamos en el acceso de San Fernando-Bahía Sur y le ayudamos con el equipaje.",
        "faq_q1": "¿Cuánto tarda Roche a Bahía Sur?",
        "faq_a1": "Aproximadamente 25 minutos (unos 28 km) según tráfico.",
        "faq_q2": "¿Dónde me recogen en Roche?",
        "faq_a2": "En la puerta de su vivienda en urbanización Roche.",
        "faq_q3": "¿Llegan a tiempo para el AVE o media distancia?",
        "faq_a3": "Sí, reserve con margen. Indique hora del tren al confirmar y salimos con antelación suficiente.",
        "other_a_slug": "taxi-roche-estacion-tren-cadiz",
        "other_a_label": "Roche &rarr; estación Cádiz",
        "other_a_p": "Traslado desde Roche a la estación de tren de Cádiz (Plaza de Sevilla).",
        "other_b_slug": "taxi-roche-aeropuerto-jerez",
        "other_b_label": "Roche &rarr; Jerez (XRY)",
        "other_b_p": "Traslado desde Roche al Aeropuerto de Jerez.",
        "title_en": "Taxi Roche to Bahia Sur station | Fixed price",
        "desc_en": "Private transfer from Roche to San Fernando-Bahia Sur train station.",
        "h1_en": ("Taxi Roche", "&rarr; Bahia Sur"),
        "title_de": "Taxi Roche zum Bahnhof Bahia Sur | Festpreis",
        "desc_de": "Privater Transfer von Roche zum Bahnhof San Fernando-Bahia Sur.",
        "h1_de": ("Taxi Roche", "&rarr; Bahia Sur"),
        "title_fr": "Taxi Roche vers Bahía Sur | Tarif fixe",
        "desc_fr": "Transfert privé de Roche à la gare San Fernando-Bahía Sur.",
        "h1_fr": ("Taxi Roche", "&rarr; Bahía Sur"),
    },
    "cadiz": {
        "src": "taxi-estacion-tren-cadiz-conil",
        "slug": "taxi-roche-estacion-tren-cadiz",
        "dest_es": "Cádiz (estación tren Plaza Sevilla)",
        "dest_q": "C%C3%A1diz%20(estaci%C3%B3n%20tren%20Plaza%20Sevilla)",
        "km": "35 KM",
        "time_es": "32 MIN",
        "via": "A-48",
        "p1": "58",
        "p2": "69",
        "title_es": "Taxi Roche a estación de tren de Cádiz | Precio Cerrado",
        "desc_es": "Traslado privado desde urbanización Roche a la estación de tren de Cádiz. Recogida a domicilio y tarifa fija.",
        "h1_top": "Taxi Roche",
        "h1_bot": "&rarr; Estación Cádiz",
        "tag": "Traslado desde Roche",
        "intro": "Traslado desde urbanización Roche hasta la estación de tren de Cádiz (Plaza de Sevilla). Recogida en su vivienda y dejada en estación.",
        "card1_h": "Recogida en Roche",
        "card1_p": "Le recogemos en urbanización Roche. Recorrido más corto hacia Cádiz que desde el casco de Conil.",
        "card2_h": "Estación de Cádiz",
        "card2_p": "Le dejamos en la estación de tren de Cádiz con tiempo para su tren.",
        "card3_h": "Equipaje incluido",
        "card3_p": "Ayuda con maletas y maletero de 563 litros, sin suplemento por equipaje razonable.",
        "card4_h": "Roche–Cádiz en unos 32 min",
        "card4_p": "Unos 35 km por la A-48. Precio cerrado por vehículo privado.",
        "fare_note": "Tarifas orientativas Roche &rarr; estación de tren de Cádiz. Calcule el precio exacto con su dirección.",
        "proto_tag": "Salida puntual",
        "proto_h": "Protocolo de <br><span class=\"text-gold\">llegada a Cádiz</span>",
        "s1h": "Recogida en Roche",
        "s1p": "Salimos de su dirección en Roche con margen respecto a su tren.",
        "s2h": "A-48 hacia Cádiz",
        "s2p": "Ruta directa por autovía hasta la capital.",
        "s3h": "Dejada en estación",
        "s3p": "Le dejamos en la estación de tren de Cádiz y le ayudamos con el equipaje.",
        "faq_q1": "¿Cuánto tarda Roche a la estación de Cádiz?",
        "faq_a1": "Aproximadamente 32 minutos (unos 35 km) según tráfico.",
        "faq_q2": "¿Dónde me recogen en Roche?",
        "faq_a2": "En la puerta de su villa o apartamento en urbanización Roche.",
        "faq_q3": "¿Es mejor Bahía Sur o Cádiz ciudad?",
        "faq_a3": "Depende de su tren. Bahía Sur suele ser más corta; Cádiz centro es útil si su tren sale de Plaza de Sevilla. Consulte horarios y reserve el destino exacto.",
        "other_a_slug": "taxi-roche-bahia-sur",
        "other_a_label": "Roche &rarr; Bahía Sur",
        "other_a_p": "Traslado más corto desde Roche a la estación San Fernando-Bahía Sur.",
        "other_b_slug": "taxi-roche-aeropuerto-jerez",
        "other_b_label": "Roche &rarr; Jerez (XRY)",
        "other_b_p": "Traslado desde Roche al Aeropuerto de Jerez.",
        "title_en": "Taxi Roche to Cadiz train station | Fixed price",
        "desc_en": "Private transfer from Roche to Cadiz train station. Door pickup, fixed fare.",
        "h1_en": ("Taxi Roche", "&rarr; Cadiz station"),
        "title_de": "Taxi Roche zum Bahnhof Cadiz | Festpreis",
        "desc_de": "Privater Transfer von Roche zum Bahnhof Cadiz.",
        "h1_de": ("Taxi Roche", "&rarr; Bahnhof Cadiz"),
        "title_fr": "Taxi Roche vers la gare de Cadix | Tarif fixe",
        "desc_fr": "Transfert privé de Roche à la gare de Cadix. Prise en charge à domicile, tarif fixe.",
        "h1_fr": ("Taxi Roche", "&rarr; Gare de Cadix"),
    },
}

ORIGEN_Q = "Conil%20de%20la%20Frontera%20(Roche%20Urbanizaci%C3%B3n)"


def book(lang: str, dest_q: str) -> str:
    if lang == "es":
        return f"/?origen={ORIGEN_Q}&destino={dest_q}#calculadora"
    if lang == "en":
        return f"/en?origen={ORIGEN_Q}&destino={dest_q}#calculadora"
    if lang == "de":
        return f"/de?origen={ORIGEN_Q}&destino={dest_q}#calculadora"
    return f"/fr/?origen={ORIGEN_Q}&destino={dest_q}#calculadora"


def make_roche_es(cfg: dict):
    src = ROOT / f"es/{cfg['src']}.html"
    dst = ROOT / f"es/{cfg['slug']}.html"
    t = src.read_text(encoding="utf-8")
    # URLs / canonical
    t = t.replace(cfg["src"], cfg["slug"])
    # Booking links (after slug replace, origin links still airport-style)
    import re
    t = re.sub(r'href="/\?origen=[^"]+#calculadora"', f'href="{book("es", cfg["dest_q"])}"', t)
    t = re.sub(r'href="/\?destino=[^"]+#calculadora"', f'href="{book("es", cfg["dest_q"])}"', t)

    # Title/description: first occurrences in head
    t = re.sub(r"<title>.*?</title>", f"<title>{cfg['title_es']}</title>", t, count=1)
    t = re.sub(
        r'<meta name="description" content="[^"]*"/>',
        f'<meta name="description" content="{cfg["desc_es"]}"/>',
        t,
        count=1,
    )
    t = re.sub(r'<meta property="og:title" content="[^"]*"/>', f'<meta property="og:title" content="{cfg["title_es"]}"/>', t, count=1)
    t = re.sub(r'<meta property="og:description" content="[^"]*"/>', f'<meta property="og:description" content="{cfg["desc_es"]}"/>', t, count=1)
    t = re.sub(r'<meta property="twitter:title" content="[^"]*"/>', f'<meta property="twitter:title" content="{cfg["title_es"]}"/>', t, count=1)
    t = re.sub(r'<meta property="twitter:description" content="[^"]*"/>', f'<meta property="twitter:description" content="{cfg["desc_es"]}"/>', t, count=1)

    # Hero
    t = re.sub(r'<span class="hero-tag">[^<]*</span>', f'<span class="hero-tag">{cfg["tag"]}</span>', t, count=1)
    t = re.sub(
        r"<h1><span class=\"hero-title-top\">[^<]*</span> <span class=\"text-gold hero-title-bottom\">.*?</span></h1>",
        f'<h1><span class="hero-title-top">{cfg["h1_top"]}</span> <span class="text-gold hero-title-bottom">{cfg["h1_bot"]}</span></h1>',
        t,
        count=1,
    )
    t = re.sub(r'<span class="stat-value">[^<]*KM</span>', f'<span class="stat-value">{cfg["km"]}</span>', t, count=1)
    t = re.sub(
        r'(<span class="stat-value">)[^<]*(</span>\s*<span class="stat-label">Tiempo</span>)',
        rf'\1{cfg["time_es"]}\2',
        t,
        count=1,
    )

    # Intro paragraph after luxury-line (first unique specialist line)
    t = re.sub(
        r'(<p style="color: var\(--text-muted\); font-size: clamp\(1\.1rem, 2\.5vw, 1\.4rem\); font-weight: 300; margin-top: 1\.5rem;">)[^<]+(</p>)',
        rf'\1{cfg["intro"]}\2',
        t,
        count=1,
    )

    # Replace first 4 luxe-card blocks (advantages)
    card_pat = re.compile(
        r'(<div class="luxe-grid reveal">)(.*?)(</div>\s*</div>\s*</section>)',
        re.S,
    )

    def cards(_m):
        html = f'''<div class="luxe-grid reveal">
                    <div class="luxe-card reveal stagger-1">
                        <i class="fas fa-home"></i>
                        <h3>{cfg["card1_h"]}</h3>
                        <p>{cfg["card1_p"]}</p>
                    </div>
                    <div class="luxe-card reveal stagger-2">
                        <i class="fas fa-map-marker-alt"></i>
                        <h3>{cfg["card2_h"]}</h3>
                        <p>{cfg["card2_p"]}</p>
                    </div>
                    <div class="luxe-card reveal stagger-3">
                        <i class="fas fa-baby-carriage"></i>
                        <h3>{cfg["card3_h"]}</h3>
                        <p>{cfg["card3_p"]}</p>
                    </div>
                    <div class="luxe-card reveal stagger-4">
                        <i class="fas fa-road"></i>
                        <h3>{cfg["card4_h"]}</h3>
                        <p>{cfg["card4_p"]}</p>
                    </div>
                </div>
            </div>
        </section>'''
        return html

    t, n = card_pat.subn(cards, t, count=1)
    if n != 1:
        print("WARN cards", cfg["slug"], n)

    # Prices: first two 6rem price blocks
    prices = re.findall(r'(<div style="font-size: 6rem; font-weight: 900; color: white; line-height: 1; margin: 20px 0;">)(\d+)(<span)', t)
    if len(prices) >= 2:
        t = t.replace(
            f'{prices[0][0]}{prices[0][1]}{prices[0][2]}',
            f'{prices[0][0]}{cfg["p1"]}{prices[0][2]}',
            1,
        )
        # second occurrence of original night price might equal day; replace sequentially
        t = t.replace(
            f'{prices[1][0]}{prices[1][1]}{prices[1][2]}',
            f'{prices[1][0]}{cfg["p2"]}{prices[1][2]}',
            1,
        )

    t = re.sub(
        r'(<p style="margin-top: 2\.5rem; font-size: 0\.85rem; color: rgba\(255,255,255,0\.4\); font-weight: 300; letter-spacing: 1px;">)[^<]+(</p>)',
        rf'\1{cfg["fare_note"]}\2',
        t,
        count=1,
    )

    # Protocol header
    t = re.sub(
        r'(<span class="hero-tag"[^>]*>)Llegada sin estrés(</span>)',
        rf'\1{cfg["proto_tag"]}\2',
        t,
        count=1,
    )
    t = re.sub(
        r"Su Protocolo de <br><span class=\"text-gold\">[^<]+</span>",
        cfg["proto_h"],
        t,
        count=1,
    )

    # Protocol 3 steps
    step_pat = re.compile(
        r'(<div class="protocol-steps">)(.*?)(</div>\s*<div class="premium-services-box)',
        re.S,
    )
    steps = f'''<div class="protocol-steps">
                        <div class="step-item reveal-left stagger-1">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <h5>{cfg["s1h"]}</h5>
                                <p style="color: var(--text-muted); line-height: 1.6;">{cfg["s1p"]}</p>
                            </div>
                        </div>
                        <div class="step-item reveal-left stagger-2">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <h5>{cfg["s2h"]}</h5>
                                <p style="color: var(--text-muted); line-height: 1.6;">{cfg["s2p"]}</p>
                            </div>
                        </div>
                        <div class="step-item reveal-left stagger-3">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <h5>{cfg["s3h"]}</h5>
                                <p style="color: var(--text-muted); line-height: 1.6;">{cfg["s3p"]}</p>
                            </div>
                        </div>
                    </div>
                    <div class="premium-services-box'''
    t, n = step_pat.subn(steps, t, count=1)
    if n != 1:
        print("WARN steps", cfg["slug"], n)

    # First 3 FAQ items
    faq_pat = re.compile(r'(<div class="faq-container">\s*)(.*?)(\s*<div class="faq-item">\s*<div class="faq-head">¿Puedo solicitar)', re.S)
    faq_new = f'''<div class="faq-container">
                    <div class="faq-item">
                        <div class="faq-head">{cfg["faq_q1"]} <i class="fas fa-chevron-down"></i></div>
                        <div class="faq-body">{cfg["faq_a1"]}</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-head">{cfg["faq_q2"]} <i class="fas fa-chevron-down"></i></div>
                        <div class="faq-body">{cfg["faq_a2"]}</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-head">{cfg["faq_q3"]} <i class="fas fa-chevron-down"></i></div>
                        <div class="faq-body">{cfg["faq_a3"]}</div>
                    </div>
                    <div class="faq-item">
                        <div class="faq-head">¿Puedo solicitar'''
    t, n = faq_pat.subn(faq_new, t, count=1)
    if n != 1:
        print("WARN faq", cfg["slug"], n)

    # Other routes cards - replace first two strong labels/links if present
    t = t.replace('Sevilla (SVQ) &harr; Conil', cfg["other_a_label"])
    t = t.replace('Málaga (AGP) &harr; Conil', cfg["other_b_label"])
    t = t.replace("/taxi-aeropuerto-sevilla-conil", f"/{cfg['other_a_slug']}" if cfg["other_a_slug"] != "taxi-roche-aeropuerto-sevilla" or cfg["slug"] != "taxi-roche-aeropuerto-jerez" else "/taxi-roche-aeropuerto-sevilla")
    # careful: slug already replaced taxi-aeropuerto-sevilla-conil if src was that
    t = t.replace(f'href="/{cfg["other_a_slug"]}"', f'href="/{cfg["other_a_slug"]}"')  # noop
    # Fix other-route hrefs more explicitly
    t = re.sub(
        r'(<strong style="font-size: 1\.25rem; font-weight: 900; color: var\(--primary\);">)[^<]+(</strong>\s*</div>\s*<p style="color: var\(--text-muted\); margin-bottom: 25px; line-height: 1\.6;">)[^<]+(</p>\s*<a href=")[^"]+(" class="btn-premium btn-orange")',
        rf'\1{cfg["other_a_label"]}\2{cfg["other_a_p"]}\3/{cfg["other_a_slug"]}\4',
        t,
        count=1,
    )
    # second card
    rest_start = t.find(cfg["other_a_p"])
    if rest_start != -1:
        chunk = t[rest_start:]
        chunk2, n = re.subn(
            r'(<strong style="font-size: 1\.25rem; font-weight: 900; color: var\(--primary\);">)[^<]+(</strong>\s*</div>\s*<p style="color: var\(--text-muted\); margin-bottom: 25px; line-height: 1\.6;">)[^<]+(</p>\s*<a href=")[^"]+(" class="btn-premium btn-orange")',
            rf'\1{cfg["other_b_label"]}\2{cfg["other_b_p"]}\3/{cfg["other_b_slug"]}\4',
            chunk,
            count=1,
        )
        if n == 1:
            t = t[:rest_start] + chunk2

    dst.write_text(t, encoding="utf-8")
    print("wrote", dst)


def make_roche_lang(lang: str, cfg: dict):
    src_name = cfg["src"]
    src = ROOT / f"{lang}/{src_name}.html"
    if not src.exists():
        print("SKIP missing", src)
        return
    dst = ROOT / f"{lang}/{cfg['slug']}.html"
    t = src.read_text(encoding="utf-8")
    t = t.replace(src_name, cfg["slug"])
    import re
    if lang == "en":
        t = re.sub(r'href="/en\?origen=[^"]+#calculadora"', f'href="{book("en", cfg["dest_q"])}"', t)
        title, desc, h1 = cfg["title_en"], cfg["desc_en"], cfg["h1_en"]
        tag = "Transfer from Roche"
    elif lang == "de":
        t = re.sub(r'href="/de\?origen=[^"]+#calculadora"', f'href="{book("de", cfg["dest_q"])}"', t)
        title, desc, h1 = cfg["title_de"], cfg["desc_de"], cfg["h1_de"]
        tag = "Transfer ab Roche"
    else:
        t = re.sub(r'href="/fr/\?origen=[^"]+#calculadora"', f'href="{book("fr", cfg["dest_q"])}"', t)
        title, desc, h1 = cfg["title_fr"], cfg["desc_fr"], cfg["h1_fr"]
        tag = "Transfert depuis Roche"

    t = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", t, count=1)
    t = re.sub(r'<meta name="description" content="[^"]*"/>', f'<meta name="description" content="{desc}"/>', t, count=1)
    t = re.sub(r'<meta property="og:title" content="[^"]*"/>', f'<meta property="og:title" content="{title}"/>', t, count=1)
    t = re.sub(r'<meta property="og:description" content="[^"]*"/>', f'<meta property="og:description" content="{desc}"/>', t, count=1)
    t = re.sub(r'<meta property="twitter:title" content="[^"]*"/>', f'<meta property="twitter:title" content="{title}"/>', t, count=1)
    t = re.sub(r'<meta property="twitter:description" content="[^"]*"/>', f'<meta property="twitter:description" content="{desc}"/>', t, count=1)
    t = re.sub(r'<span class="hero-tag">[^<]*</span>', f'<span class="hero-tag">{tag}</span>', t, count=1)
    t = re.sub(
        r"<h1><span class=\"hero-title-top\">[^<]*</span> <span class=\"text-gold hero-title-bottom\">.*?</span></h1>",
        f'<h1><span class="hero-title-top">{h1[0]}</span> <span class="text-gold hero-title-bottom">{h1[1]}</span></h1>',
        t,
        count=1,
    )
    t = re.sub(r'<span class="stat-value">[^<]*KM</span>', f'<span class="stat-value">{cfg["km"]}</span>', t, count=1)
    prices = re.findall(r'(<div style="font-size: 6rem; font-weight: 900; color: white; line-height: 1; margin: 20px 0;">)(\d+)(<span)', t)
    if len(prices) >= 2:
        t = t.replace(f'{prices[0][0]}{prices[0][1]}{prices[0][2]}', f'{prices[0][0]}{cfg["p1"]}{prices[0][2]}', 1)
        t = t.replace(f'{prices[1][0]}{prices[1][1]}{prices[1][2]}', f'{prices[1][0]}{cfg["p2"]}{prices[1][2]}', 1)
    dst.write_text(t, encoding="utf-8")
    print("wrote", dst)


def patch_redirects():
    p = ROOT / "_redirects"
    t = p.read_text(encoding="utf-8")
    block = """
/taxi-roche-aeropuerto-jerez /es/taxi-roche-aeropuerto-jerez.html 301
/taxi-roche-aeropuerto-jerez-en /en/taxi-roche-aeropuerto-jerez.html 301
/taxi-roche-aeropuerto-jerez-de /de/taxi-roche-aeropuerto-jerez.html 301
/taxi-roche-aeropuerto-jerez-fr /fr/taxi-roche-aeropuerto-jerez.html 301

/taxi-roche-aeropuerto-sevilla /es/taxi-roche-aeropuerto-sevilla.html 301
/taxi-roche-aeropuerto-sevilla-en /en/taxi-roche-aeropuerto-sevilla.html 301
/taxi-roche-aeropuerto-sevilla-de /de/taxi-roche-aeropuerto-sevilla.html 301
/taxi-roche-aeropuerto-sevilla-fr /fr/taxi-roche-aeropuerto-sevilla.html 301

/taxi-roche-aeropuerto-malaga /es/taxi-roche-aeropuerto-malaga.html 301
/taxi-roche-aeropuerto-malaga-en /en/taxi-roche-aeropuerto-malaga.html 301
/taxi-roche-aeropuerto-malaga-de /de/taxi-roche-aeropuerto-malaga.html 301
/taxi-roche-aeropuerto-malaga-fr /fr/taxi-roche-aeropuerto-malaga.html 301

/taxi-roche-bahia-sur /es/taxi-roche-bahia-sur.html 301
/taxi-roche-bahia-sur-en /en/taxi-roche-bahia-sur.html 301
/taxi-roche-bahia-sur-de /de/taxi-roche-bahia-sur.html 301
/taxi-roche-bahia-sur-fr /fr/taxi-roche-bahia-sur.html 301

/taxi-roche-estacion-tren-cadiz /es/taxi-roche-estacion-tren-cadiz.html 301
/taxi-roche-estacion-tren-cadiz-en /en/taxi-roche-estacion-tren-cadiz.html 301
/taxi-roche-estacion-tren-cadiz-de /de/taxi-roche-estacion-tren-cadiz.html 301
/taxi-roche-estacion-tren-cadiz-fr /fr/taxi-roche-estacion-tren-cadiz.html 301
"""
    if "taxi-roche-aeropuerto-jerez" not in t:
        t = t.replace(
            "/taxi-bahia-sur-conil-fr /fr/taxi-bahia-sur-conil.html 301",
            "/taxi-bahia-sur-conil-fr /fr/taxi-bahia-sur-conil.html 301\n" + block,
        )
        p.write_text(t, encoding="utf-8")
        print("redirects updated")
    else:
        print("redirects already present")


def patch_index_footers():
    replacements = [
        ("es/index.html",
         'Traslado aeropuerto de Gibraltar (GIB)',
         'Traslado al paso fronterizo de Gibraltar',
         """                    <a href="/taxi-roche-aeropuerto-jerez" style="color: rgba(255,255,255,0.7); text-decoration: none; display: block; margin-bottom: 1rem; transition: var(--transition);">Taxi Roche al aeropuerto de Jerez</a>
                    <a href="/taxi-roche-aeropuerto-sevilla" style="color: rgba(255,255,255,0.7); text-decoration: none; display: block; margin-bottom: 1rem; transition: var(--transition);">Taxi Roche al aeropuerto de Sevilla</a>
                    <a href="/taxi-roche-aeropuerto-malaga" style="color: rgba(255,255,255,0.7); text-decoration: none; display: block; margin-bottom: 1rem; transition: var(--transition);">Taxi Roche al aeropuerto de Málaga</a>
                    <a href="/taxi-roche-bahia-sur" style="color: rgba(255,255,255,0.7); text-decoration: none; display: block; margin-bottom: 1rem; transition: var(--transition);">Taxi Roche a Bahía Sur</a>
                    <a href="/taxi-roche-estacion-tren-cadiz" style="color: rgba(255,255,255,0.7); text-decoration: none; display: block; margin-bottom: 1rem; transition: var(--transition);">Taxi Roche a estación de Cádiz</a>
"""),
        ("index.html",
         'Traslado aeropuerto de Gibraltar (GIB)',
         'Traslado al paso fronterizo de Gibraltar',
         None),
    ]
    for path, old, new, extra in replacements:
        p = ROOT / path
        if not p.exists():
            continue
        t = p.read_text(encoding="utf-8")
        t = t.replace(old, new)
        if extra and "taxi-roche-aeropuerto-jerez" not in t:
            t = t.replace(
                '<a href="/taxi-aeropuerto-gibraltar-conil"',
                extra + '                    <a href="/taxi-aeropuerto-gibraltar-conil"',
                1,
            )
        p.write_text(t, encoding="utf-8")
        print("footer", path)


if __name__ == "__main__":
    patch_gibraltar_es()
    patch_gibraltar_en()
    patch_gibraltar_de()
    patch_gibraltar_fr()
    for key, cfg in ROCHE.items():
        make_roche_es(cfg)
        for lang in ("en", "de", "fr"):
            make_roche_lang(lang, cfg)
    patch_redirects()
    patch_index_footers()
