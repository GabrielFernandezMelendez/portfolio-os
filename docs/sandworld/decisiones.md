# Sandworld — decisiones de diseño

Lo que ya está decidido. Antes de cambiar algo de esta lista, se pregunta.

## Mundo y arenas
- Cada partida tendrá semilla aleatoria (mapa y especies), con opción de introducir una semilla para repetir un mapa.
- El Manantial **no** frena el fuego ni la Tierra Quemada; sobre la Tierra Quemada su agua se evapora.
- La Duna no afecta al fuego. Escarcha y Marea sí: muro helado (hay que renovarlo) y zanja de roca sin combustible.
- La Tierra Quemada nace con 9 tiles quemados juntos, crece despacio por sus bordes y no deja hacer lagos dentro.
  Mientras tenga criaturas no se puede destruir, solo contener; sin vida remite de fuera hacia dentro.
  **No remite sola**: remitirá cuando se maten las criaturas que vivirán en ella (fase 7). Hasta entonces no se
  cambia cómo funciona.

## Fauna
- Las especies se implementan de una en una; sus sprites son isométricos (mockup → aprobación → código).
- Equilibrio con **riesgo doble**: mucha comida → muchas crías (se deciden en el celo, nacen meses después) → hambruna;
  una población pequeña o dispersa → vulnerable (sin pareja, presa fácil). Mantener el equilibrio es cosa del jugador.
- Los animales no aparecen solos al empezar: **llegan por la orilla**. Cada 3 días, si la isla puede alimentar a más
  de una especie, puede llegar un grupo suyo (más probable cuanto más sitio hay y menos grupos suyos hay ya). El
  tope de grupos se tira cada vez entre 1 y 2 por chunk (en un 2×2, de 4 a 8): el tope también es una
  probabilidad. Un depredador solo llega si hay presas para él. Así una isla no se queda vacía para siempre: el
  equilibrio sale de llegadas y marchas, y lo que haga el jugador lo mueve, pero nada se extingue solo por existir.
- **Una manada con hambre de verdad puede irse de la isla** (tirada diaria que sube con el hambre): normalmente
  antes de morir, pero no siempre. Más adelante también llegarán con cartas y expansión.
- **La isla tutorial (2×2)** tiene como mucho 6–7 grupos en general (de 3 a 5 colonias de conejos, de 1 a 5
  manadas de ciervos y 1 de lobos, a veces 2).
- **Buscan agua y comida hasta encontrarla o morir**: primero lo que ven, luego los sitios que recuerda su manada
  (los últimos donde bebió y comió bien) y, si no, cada hora buscan más lejos (hasta toda la isla), caminando con
  rumbo. Con mucha sed, beber va antes que cazar, volver a casa o dormir. En invierno la nieve y el hielo también
  sirven de agua (se los comen). Los tiempos hasta morir de hambre y de sed no se cambian ahora.
- **Isla llena**: si ya no caben más grupos, el joven que se independiza o la parte de una manada que se separa no
  encuentra sitio y se va de la isla.
- Las **crías de refugio** maman cuando su madre pasa por el refugio (se mira cada hora): solo peligran si la madre
  no viene en todo el día.
- Ficha del animal: Vida (heridas y enfermedad), Sueño, Hambre, Sed y Felicidad en barras con porcentaje
  (**llena = bien**), raza, nombre, días vivo, "Le afecta", diario con scroll y órdenes Comer, Dormir y Correr.
- La **vejez es una sorpresa**: no se muestra cuánto vivirá.
- El **miedo no tiene barra**: se muestra como un **estado** abajo en la ficha ("Asustado"), igual que
  "Sediento" o "Hambriento". Sobre todo se ve en el comportamiento (se quedan quietos, huyen hasta relajarse,
  estampidas, evitan zonas, no duermen con tormenta).
- Sobre la cabeza sale un **"!"** al asustarse y un **"?"** cuando algo le da curiosidad, unos segundos, para que el
  jugador abra la ficha y descubra qué pasa.
- Las **distancias de cada especie se dan en islas** (no se hacen islas más grandes): de día un adulto explora por
  su cuenta hasta 1,5 islas de su manada (el ciervo) y por la noche vuelven a dormir juntos; huyendo se alejan hasta
  1 isla del peligro. Cruzan de una isla a otra. Quien no vuelve a dormir con los suyos se ha perdido.
- Correr cansa pero no deja dormido: después de correr jadean un rato y la adrenalina no les deja dormirse.
- **De lejos (zoom ×1 y ×1,5) cada manada es una moneda** con la cara de su especie y el número de animales,
  encima de todo; desde ×2 se ven los animales. Tocar la moneda abre la ficha de la guía. Cada especie nueva
  necesita su cara de moneda.
- **Correr desde la vista de moneda hace correr a toda la manada.** Cada adulto sale con el grupo con un 75 % de
  probabilidad (ciervo) y se separa con un 25 %; las crías van con su madre. El separado anda despistado: si se
  cruza con los suyos los encuentra; si no, al caer la tarde los encuentra con un 60 % y, si no, pasa la noche
  perdido (y entonces vuelve, se une a otra manada o se queda solo).
- **Conejo**: vive en colonias con madriguera (dentro duermen, crían y se esconden; dentro no se ven). Nocturno.
  Cría en primavera y verano: cada camada es una tirada de 2 a 7 crías (4 o 5 lo más común; con superpoblación o
  hambre, menos). Ante un susto se queda quieto (55 %) o corre a la madriguera en zigzag. Los machos se alejan más
  que las hembras y los jóvenes se van a fundar colonias (60 % machos, 25 % hembras). La enfermedad brota con
  superpoblación y es su freno hasta que llegue un depredador. La Marea derrumba la madriguera, el agua la inunda y
  la arena la tapa. Sacan parte del agua de lo que comen, pero beben cada día; cavan, a ser posible, cerca del agua.
- **Refugios**: madriguera (agujero isométrico del conejo), cueva de roca (guarida natural del lobo, existe si la
  manada estaba allí al descubrir la isla) y guarida de ramas y piedras (la construyen los lobos sin cueva libre).
  Las vacías las puede ocupar otra manada. Se destruyen **por cantidad y tiempo**, siempre por tiradas: cada Marea
  encima puede derrumbarlos un poco; la arena o el humus que suben el suelo en la entrada la tapan y, cuanto más
  y más tiempo, más fácil que se hundan. **La cueva de roca no se destruye: solo se tapa** (arena o agua, como
  cuando se hace un río o una duna).
- **Lobo** (primer depredador): manada con pareja dominante (solo ella cría, en invierno; lobeznos en primavera en
  la guarida). Huele presas y carroña hasta 2 islas (menos probable cuanto más lejos). Caza por tiradas: acecha,
  y si la presa le ve, persigue; prefiere crías, débiles y solitarias; con un ciervo adulto casi siempre falla, y
  el ciervo puede plantar cara. Con poca presa cerca se va de viaje de caza unos días y vuelve; lleva carne a los
  lobeznos (cansa más; otro le releva por tirada). Aúlla al anochecer y las presas se sobresaltan. Ojos rojo
  saturado en el sprite y la moneda. Cuánto come y lo fácil que caza no se tocan: son realistas.
- **Ciervo**: gemelos al 40 % (si la madre está bien comida) y vive de 4 a 7 años.
- Los olfatos, el miedo, la alarma y las señales "!" "?" son comunes a todas las especies.
- Las madrigueras abandonadas las ocupa otra colonia o se hunden solas en 30 días.
- **Volver a casa a tiempo es una tirada**: cada tarde (amanecer, en el conejo) un animal puede entretenerse y salir
  tarde (ciervo 10 %, de 1 a 5 h; conejo 15 %, de 30 min a 4 h); si no llega, duerme lejos y a la intemperie, y
  se ha perdido. La guía del conejo vuelve hacia la madriguera con un 60 % cada hora si se ha alejado comiendo.
  Así un animal puede quedarse fuera y ser presa de un depredador (cuando lleguen).
- Los comportamientos naturales son comunes a todas las especies (espacio personal, reacciones, tiempo) y cada
  especie los ajusta con su registro y su temperamento.
- Correr (orden) puede hacer que el animal pierda su manada; ese momento será una decisión del jugador (fase 5).
- Los nombres se generan solos y son irónicos (nombres de persona o de su comida favorita: Bellota, Brote;
  un lobo "Conejito" por la comida favorita de su padre).

## Para la fase de pulido (no hacer antes)
- **Carácter de cada individuo** (al estilo de Dwarf Fortress): rasgos que cambian sus probabilidades (miedoso,
  curioso, solitario...), gustos y recuerdos que se vean en el diario.
- Selfies pixel art graciosos de cada animal con complementos (parche, cigarro, monóculo, tupé…).
- Afinar los nombres irónicos.
- Feedback visual cuando la Marea o la Escarcha frenan la Tierra Quemada.
- ¿"!" o "?" sobre la moneda de una manada (vista de lejos)? Se decide según lo que digan los jugadores.
- Ajustar duraciones de animaciones, restos de plantas y árboles en el agua.
- Ajustar todos los valores marcados como [PROPUESTA] en `config/`.
- Ritmo del tiempo (20 minutos de persecución se ven como segundos).
- Más días de evitar la zona donde cazaron.
- **Que se vea al lobo pasándolo mal**: aguantar más en ayunas (un lobo real aguanta 2–3 semanas), manada flaca,
  cazas desesperadas, en vez de irse pronto de la isla.
- Revisar los tiempos hasta morir de hambre y de sed si hace falta.
- Lobos: matar de más (surplus killing), peleas entre manadas, enfermedades del lobo, carroñeros.
