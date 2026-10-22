# Sandworld — decisiones de diseño

Lo que ya está decidido. Antes de cambiar algo de esta lista, se pregunta.

## Mundo y arenas
- **El invierno no hiela toda la isla**: el frío baja con la altura. La mitad más baja de la isla no se hiela ni se
  nieva (siempre hay tierra y agua líquida en lo bajo) y el frío crece hasta lo más alto. El desierto nunca se
  hiela; la tundra, siempre.
- Cada partida tendrá semilla aleatoria (mapa y especies), con opción de introducir una semilla para repetir un mapa.
- El Manantial **no** frena el fuego ni la Tierra Quemada; sobre la Tierra Quemada su agua se evapora.
- La Duna no afecta al fuego. Escarcha y Marea sí: muro helado (hay que renovarlo) y zanja de roca sin combustible.
- La Tierra Quemada nace con 9 tiles quemados juntos, crece despacio por sus bordes y no deja hacer lagos dentro.
  Mientras tenga criaturas no se puede destruir, solo contener; sin vida remite de fuera hacia dentro.
  **No remite sola**: solo empieza a remitir cuando **han muerto todos los goblins de esa zona**. Las arenas pueden
  destruir sus nidos, pero los goblins que sobreviven cavan otros.

## Fauna
- Las especies se implementan de una en una; sus sprites son isométricos (mockup → aprobación → código).
- Equilibrio con **riesgo doble**: mucha comida → muchas crías (se deciden en el celo, nacen meses después) → hambruna;
  una población pequeña o dispersa → vulnerable (sin pareja, presa fácil). Mantener el equilibrio es cosa del jugador.
- Los animales no aparecen solos al empezar: **llegan por la orilla**. Cada 3 días, si la isla puede alimentar a más
  de una especie, puede llegar un grupo suyo (más probable cuanto más sitio hay y menos grupos suyos hay ya). Así
  una isla no se queda vacía para siempre: el equilibrio sale de llegadas y marchas, y lo que haga el jugador lo
  mueve, pero nada se extingue solo por existir. Más adelante también llegarán con cartas y expansión.
- **Topes de grupos (no de individuos), tirados cada vez**: el de la isla, de 1 a 2 grupos por chunk (en un 2×2, de 4
  a 8), y el de cada especie, para que nunca la llene una sola: en un 2×2, de 3 a 4 colonias de conejos, de 1 a 5
  manadas de ciervos y de 1 a 2 de lobos. **Si una especie se pasa de su tope, uno de sus grupos puede irse**
  (tirada, más cuanto más se pase): se premia al jugador que mantiene el equilibrio.
- **Una especie que desaparece de la isla** (se va o se extingue) no vuelve antes de 60 días; desde ahí la tirada
  de que llegue sube poco a poco hasta los 80 días (y puede tardar más). Perderla es un castigo de verdad.
- **Solo el depredador se va por hambre** (tirada diaria que sube con el hambre, cuando ya lo está pasando mal):
  normalmente antes de morir, pero no siempre. Los herbívoros aguantan el invierno: premia al jugador que ha
  mantenido una población sana el resto del año.
- **Lobos de fuera**: solo llegan si no queda ni un lobo en la isla y les atrae el olor de la carroña, y llega una
  pareja (a veces con un joven), que es como se funda un territorio nuevo. Las manadas que ya están al descubrir la
  isla son de 5. La segunda manada nace aquí (jóvenes que fundan la suya), si cabe en su tope.
- **Apetito en invierno por especie**: el ciervo come un 30 % menos y el conejo un 20 % menos (tiran de sus
  reservas); el lobo, un 20 % más con el frío.
- **La enfermedad brota con apretura**: falta de comida, colonia casi llena o especie cerca de su tope en la isla;
  cuanto más apretada, más probable.
- Al partirse una manada, las crías se quedan siempre con su madre.
- **Cuántos llegan es una tirada en todas las especies** (p. ej. cuervos y lobos: una pareja con de 1 a 3 crías).
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
- **Cuervo**: moneda con la cabeza vista desde arriba (dos ojos rojos, pico largo hacia abajo); ojos rojos también en
  el sprite. **Humanos**: dibujados con el doble de píxeles que los animales (mismo tamaño en la isla), de tres
  cuartos con volumen, sin blanco en los ojos; la mujer con su propio diseño (vestido largo con flecos, cinta,
  melena larga y collar de cuentas). **Criaturas de la Tierra Quemada**: goblins verdes pequeños con garrote de
  hueso; viven en nidos de carbón. El diseño de criatura de ceniza y brasa queda guardado para otra especie.
- **Cuervo**: vuela (el agua y las terrazas no le cortan el paso; vuela a partir de 3 celdas), anida en la copa de
  un árbol, caza crías de conejo, roba un trozo de las presas de otros, vuelve donde hubo carne y come frutos con
  hambre. Llega en pareja con 1 a 3 crías.
- **Humanos**: banda nómada (pareja con 1 a 3 hijos) que caza ciervos y conejos y recolecta; choza de pieles;
  crían todo el año. Plantan cara al depredador y, en grupo, pueden matarlo. Los lobos cazan sobre todo a sus
  niños. La expansión (colonia, refugios que mejoran) llega más adelante.
- **Goblins** (criaturas de la Tierra Quemada): **nacen solos de 5 a 7 días después** de formarse una zona de
  Tierra Quemada (nidos y tamaño, ver más abajo). Viven de noche: el sol les quema si les
  pilla fuera; la escarcha que sella su nido les congela. El fuego no les hace nada, pero **la Brasa no les da
  vida**. Cazan conejos, ciervos, cuervos y **también humanos**; comer alimenta su Tierra Quemada. No llegan ni se
  van por la orilla.
- **Equilibrio con 6 especies** (tras la prueba de un año en un 3×3): el lobo come menos (hambre 0,2 al día), solo
  caza por debajo de 0,35 de saciedad y vuelve a rematar su presa desde 0,7. Los restos pegados a los huesos (la
  cuarta parte de la carne) solo los come el cuervo; la carroña atrae a los cuervos (el doble de llegadas) pero
  llegan sin ella y caben en un 2×2. Una presa dormida a la intemperie es mucho más fácil de cazar (+0,4).
- **Goblins**: de lo más rápidos de la isla (corriendo 1,05; solo el cuervo en vuelo les gana), de noche recorren
  hasta 4 islas y cazan a cualquier especie (también lobos); comen menos (hambre 0,25). Dos horas antes del alba
  vuelven corriendo al nido; si no llegan, se quedan bajo un árbol, donde de día los cazan humanos y lobos.
  **Como mucho 2 nidos por isla** (uno, o dos si la zona tiene 18 tiles o más), en el corazón de la zona (lo más
  lejos de su borde); de 1 a 3 goblins por nido más 1 por cada 20 tiles, hasta 5; un nido no pasa de 6 y solo
  crían bien comidos. Con el tope de nidos, ni se dividen ni se van a fundar otro.
- **Combate** (común a todas las especies): al alcanzar a la presa luchan cuerpo a cuerpo de 3 a 6 minutos de juego,
  encarados, con la espada sobre los dos; después, la tirada de siempre: cae, escapa herida (pierde algo de vida y
  sale con el icono de huida) o planta cara (y huyen los cazadores, también con el icono de huida). Golpes por
  turnos: se echa atrás, embiste, el golpeado parpadea en blanco, retrocede y tiembla; polvo al embestir.
  **Sangre activable en Ajustes** (por defecto sí): gotas que saltan y manchan el suelo un día, charco bajo los
  muertos en combate o cazados, rastro del que huye herido; sin sangre, una chispa blanca en cada golpe. Se puede
  retocar cuando Gabriel lo vea en el móvil.
- **Cadáveres**: se mide cuánto se han comido (carne que queda frente a la que tenía). Estados: fresco, comido,
  huesos (queda el 15 %: solo comen los cuervos) y limpio. El dibujo de cada estado, pendiente del mockup.
- El cuervo cuenta como comida los restos de las presas de otros (conejos incluidos) además de la fruta y la carroña.
- **Restos para el cuervo**: cuando a un cadáver le queda el **15 %** de su carne, lobos, humanos y goblins lo dejan.
- **Lobos en manada**: cuando uno caza, los suyos (a menos de 2 islas) acuden a comer de la presa; un adulto bien
  comido lleva comida (regurgita) al joven más hambriento que aún no caza; desde la mitad de su edad de cría los
  jóvenes pueden acompañar una cacería. Los goblins cazan menos lobos (preferencia 0,2).
- **Temperatura** (escala del mundo 0..1, ~0,2 hiela, ~0,5 templado; 0,1 ≈ 5 °C): la Tierra Quemada viva
  da calor (+0,6 encima, +0,2 en los tiles de al lado); su calor deshace la Escarcha por dentro, así que la Escarcha
  solo contiene el borde, y un nido vivo nunca se congela. Cada especie tiene su franja de comodidad (ciervo -0,2..1,
  conejo -0,1..0,98, lobo -0,4..0,95, cuervo -0,2..1,05, humano 0,1..1,02, goblin 0,3..sin tope de calor; una tarde
  de verano típica está en ~0,7 y el desierto en verano llega a ~1). Fuera de
  ella acumula frío o calor; desde la mitad busca abrigo (su refugio o los suyos) o sombra; desde 1, hipotermia o
  golpe de calor (pierde vida cada hora). Protegen el refugio (+0,3), dormir apiñado (+0,1) y la sombra (-0,1 de
  calor). Los demás animales evitan el calor de la Tierra Quemada.
- **Los goblins hibernan en invierno** en su nido: duermen, no salen aunque tengan hambre y apenas gastan (10 %).
  Ir a matarlos mientras hibernan (mandar humanos) será una decisión del jugador (fase 5).
- Nidos de goblin en el corazón de su zona de Tierra Quemada (la zona puede estar en cualquier parte de la isla).
- Grupos de tamaño aleatorio en todas las especies (pareja más 1 a 3 crías en lobos y cuervos, por ejemplo).
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
- **Zoom y humanos en alta densidad**: los humanos se dibujan con el doble de píxeles; en los zooms ×1,5 y ×3 sus
  píxeles se ven desiguales. Se decide tras la primera prueba si se quitan esos zooms o se deja así.
- **Mandar correr a un animal muchas veces en una semana hace que acabe yéndose de la isla** (así el jugador puede
  intentar formar grupos equilibrados, con un coste).
- **Rendimiento**: los chunks se redibujan como mucho uno por frame y solo los que se ven (los de fuera esperan a
  verse); la simulación no cambia. Siguiente paso, con el mismo resultado en pantalla: hornear solo los tiles que
  cambian o hornear en un Web Worker.
- La vegetación y los biomas se revisan cada hora **chunk a chunk, cada uno en su minuto** (antes, todos en el minuto
  en punto): cada chunk sigue revisándose una vez por hora, como mucho 59 minutos de juego antes o después (unos 15 s
  reales a ×1). La hora de la fauna (hambre, partos, sol) sigue en el minuto en punto.
- **Rendimiento con islas grandes y mucha población**: ver el informe de rendimiento de la fase 4 (mover la física
  a un Web Worker, repartir la física y la fauna por chunks cercanos a la cámara, etc. en la fase 9).
- **Los lobos se van demasiado pronto de un 2×2** (en las pruebas pasaban entre 11 y 28 días de 120 en la isla) y
  luego tardan en volver. Hoy llega una pareja; se revisará el equilibrio del lobo (cuánto come, la vuelta).
