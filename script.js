/* =========================================================
   PRESUPUESTO ELÉCTRICO - LÓGICA (JavaScript)
   Todo el archivo está comentado paso a paso para que puedas
   entenderlo y modificarlo sin problema.
   ========================================================= */

// Esperamos a que todo el HTML esté cargado antes de tocar el DOM.
document.addEventListener('DOMContentLoaded', () => {

  /* ---------------------------------------------------------
     1) MENÚ HAMBURGUESA (versión celular)
     --------------------------------------------------------- */
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');

  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('activo');
    nav.classList.toggle('abierto');
  });

  // Si el usuario toca un link del menú en celular, lo cerramos.
  nav.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
      menuToggle.classList.remove('activo');
      nav.classList.remove('abierto');
    });
  });


  /* ---------------------------------------------------------
     1bis) DATOS DEL TRÁMITE (profesional, cliente y fecha)
     - La fecha se completa sola con el día de hoy.
     - Los datos del profesional (nombre, teléfono, DNI) se
       guardan en este navegador (localStorage) para que no haya
       que volver a tipearlos en cada presupuesto nuevo.
     - Cliente se deja siempre vacío para cargar en cada trabajo.
     --------------------------------------------------------- */
  const dtProfesional = document.getElementById('dtProfesional');
  const dtTelefono = document.getElementById('dtTelefono');
  const dtDni = document.getElementById('dtDni');
  const dtCliente = document.getElementById('dtCliente');
  const dtFecha = document.getElementById('dtFecha');

  // Fecha de hoy en formato YYYY-MM-DD (lo que pide el input type="date")
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  dtFecha.value = hoyISO;

  // Restauramos los datos del profesional guardados de una visita anterior
  dtProfesional.value = localStorage.getItem('dt_profesional') || '';
  dtTelefono.value = localStorage.getItem('dt_telefono') || '';
  dtDni.value = localStorage.getItem('dt_dni') || '';

  dtProfesional.addEventListener('input', () => localStorage.setItem('dt_profesional', dtProfesional.value));
  dtTelefono.addEventListener('input', () => localStorage.setItem('dt_telefono', dtTelefono.value));
  dtDni.addEventListener('input', () => localStorage.setItem('dt_dni', dtDni.value));

  // Convierte la fecha (YYYY-MM-DD) a formato legible dd/mm/aaaa
  function fechaLegible() {
    if (!dtFecha.value) return '—';
    const [anio, mes, dia] = dtFecha.value.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  // Arma el bloque de encabezado (profesional / cliente / fecha) que se
  // reutiliza tanto en el PDF como en el texto para compartir.
  function armarEncabezadoTramite() {
    return {
      profesional: dtProfesional.value || '—',
      telefono: dtTelefono.value || '—',
      dni: dtDni.value || '—',
      cliente: dtCliente.value || '—',
      fecha: fechaLegible()
    };
  }


  /* ---------------------------------------------------------
     2) ACORDEONES (secciones desplegables naranjas)
     --------------------------------------------------------- */
  const secciones = document.querySelectorAll('.acordeon-seccion');

  secciones.forEach(seccion => {
    const header = seccion.querySelector('.acordeon-header');
    const body = seccion.querySelector('.acordeon-body');

    header.addEventListener('click', () => {
      const estaAbierta = seccion.classList.contains('abierta');

      if (estaAbierta) {
        // Cerrar: le sacamos la clase y el max-height vuelve a 0 (ver CSS)
        seccion.classList.remove('abierta');
        body.style.maxHeight = null;
      } else {
        // Abrir: usamos scrollHeight para saber la altura real del
        // contenido y animar el "despliegue" de forma suave.
        seccion.classList.add('abierta');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });

    // Abrimos la primera sección (Visita y servicios generales) por defecto.
    if (seccion.dataset.seccion === 'visita') {
      seccion.classList.add('abierta');
      body.style.maxHeight = body.scrollHeight + 'px';
    }
  });


  /* ---------------------------------------------------------
     3) FORMATO DE MONEDA
     Convierte un número (ej: 3200.5) en texto tipo "$3.200,50"
     --------------------------------------------------------- */
  function formatearMoneda(numero) {
    return numero.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }


  /* ---------------------------------------------------------
     4) VALIDACIÓN DE UN INPUT NUMÉRICO
     No permite valores negativos ni vacíos raros; si el valor
     no es válido, marca el input en rojo (clase .invalido).
     --------------------------------------------------------- */
  function validarInputNumerico(input) {
    const valor = parseFloat(input.value);

    if (isNaN(valor) || valor < 0) {
      input.classList.add('invalido');
      return 0; // usamos 0 para que no rompa la suma del total
    }

    input.classList.remove('invalido');
    return valor;
  }


  /* ---------------------------------------------------------
     5) CALCULAR UNA FILA (cantidad x precio unitario)
     --------------------------------------------------------- */
  function calcularFila(fila) {
    const inputCantidad = fila.querySelector('.input-cantidad');
    const inputPrecio = fila.querySelector('.input-precio');
    const spanSubtotal = fila.querySelector('.subtotal-fila');

    const cantidad = validarInputNumerico(inputCantidad);
    const precio = validarInputNumerico(inputPrecio);

    const subtotal = cantidad * precio;
    spanSubtotal.textContent = formatearMoneda(subtotal);

    return subtotal;
  }


  /* ---------------------------------------------------------
     6) CALCULAR EL SUBTOTAL DE UNA SECCIÓN COMPLETA
     Suma el subtotal de todas sus filas y actualiza el
     numerito naranja que aparece en la cabecera del acordeón.
     --------------------------------------------------------- */
  function calcularSeccion(seccion) {
    const filas = seccion.querySelectorAll('.fila-material');
    let totalSeccion = 0;

    filas.forEach(fila => {
      totalSeccion += calcularFila(fila);
    });

    seccion.querySelector('.acordeon-header__subtotal').textContent = formatearMoneda(totalSeccion);

    return totalSeccion;
  }


  /* ---------------------------------------------------------
     7) CALCULAR EL TOTAL GENERAL DEL PRESUPUESTO
     Recorre TODAS las secciones, arma el resumen y actualiza
     el total final (con o sin IVA según el checkbox).
     --------------------------------------------------------- */
  const listaResumen = document.getElementById('listaResumen');
  const totalFinalEl = document.getElementById('totalFinal');
  const totalBarraEl = document.getElementById('totalBarra');
  const checkIva = document.getElementById('checkIva');

  function calcularTotalGeneral() {
    let totalGeneral = 0;
    listaResumen.innerHTML = ''; // limpiamos el resumen para reconstruirlo

    secciones.forEach(seccion => {
      const subtotalSeccion = calcularSeccion(seccion);
      totalGeneral += subtotalSeccion;

      // Nombre "lindo" de la sección, tomado del propio título del acordeón
      const nombreSeccion = seccion.querySelector('.acordeon-header__titulo').textContent;

      const item = document.createElement('li');
      item.innerHTML = `<span>${nombreSeccion}</span><span>${formatearMoneda(subtotalSeccion)}</span>`;
      listaResumen.appendChild(item);
    });

    // Si el checkbox de IVA está tildado, sumamos un 21% extra.
    if (checkIva.checked) {
      const iva = totalGeneral * 0.21;
      totalGeneral += iva;

      const itemIva = document.createElement('li');
      itemIva.innerHTML = `<span>IVA (21%)</span><span>${formatearMoneda(iva)}</span>`;
      listaResumen.appendChild(itemIva);
    }

    const textoTotal = formatearMoneda(totalGeneral);
    totalFinalEl.textContent = textoTotal;
    totalBarraEl.textContent = textoTotal;

    // Pequeña animación de "pulso" en la barra fija para que se note
    // que el total cambió (mejora la sensación de app funcional).
    totalBarraEl.classList.remove('pulso');
    void totalBarraEl.offsetWidth; // truco para reiniciar la animación
    totalBarraEl.classList.add('pulso');
  }

  checkIva.addEventListener('change', calcularTotalGeneral);


  /* ---------------------------------------------------------
     8) CREAR UNA FILA NUEVA (botón "+ Agregar material")
     Clona la primera fila de la tabla como plantilla, la
     vacía y le vuelve a enganchar los eventos.
     --------------------------------------------------------- */
  function crearFilaNueva(tbody) {
    const filaPlantilla = tbody.querySelector('.fila-material');
    const filaNueva = filaPlantilla.cloneNode(true);

    filaNueva.classList.add('nueva'); // dispara la animación de aparición

    // Vaciamos los valores para que el usuario cargue los suyos
    filaNueva.querySelector('.input-nombre').value = '';
    filaNueva.querySelector('.input-cantidad').value = 1;
    filaNueva.querySelector('.input-precio').value = 0;
    filaNueva.querySelector('.subtotal-fila').textContent = formatearMoneda(0);

    tbody.appendChild(filaNueva);
    engancharEventosFila(filaNueva);
    filaNueva.querySelector('.input-nombre').focus();

    calcularTotalGeneral();
  }


  /* ---------------------------------------------------------
     9) ENGANCHAR EVENTOS A UNA FILA (nueva o existente)
     Cada vez que el usuario escribe en cantidad/precio,
     recalculamos todo. Y el botón ✕ elimina la fila.
     --------------------------------------------------------- */
  function engancharEventosFila(fila) {
    const inputs = fila.querySelectorAll('.input-cantidad, .input-precio');

    inputs.forEach(input => {
      input.addEventListener('input', calcularTotalGeneral);
    });

    const btnQuitar = fila.querySelector('.btn-quitar');
    btnQuitar.addEventListener('click', () => {
      const tbody = fila.closest('.tabla-materiales__cuerpo');

      // No dejamos que una sección quede sin ninguna fila,
      // para que la tabla no se vea rota.
      if (tbody.querySelectorAll('.fila-material').length <= 1) {
        alert('Cada categoría necesita al menos un material cargado.');
        return;
      }

      fila.remove();
      calcularTotalGeneral();
    });
  }


  /* ---------------------------------------------------------
     10) INICIALIZAR: enganchar eventos a las filas que ya
     vienen en el HTML + a los botones "+ Agregar material"
     --------------------------------------------------------- */
  document.querySelectorAll('.fila-material').forEach(engancharEventosFila);

  document.querySelectorAll('.btn-agregar').forEach(boton => {
    boton.addEventListener('click', () => {
      const tbody = boton.closest('.acordeon-body').querySelector('.tabla-materiales__cuerpo');
      crearFilaNueva(tbody);

      // Si la sección estaba cerrada, la abrimos para que se vea la fila
      const seccion = boton.closest('.acordeon-seccion');
      const body = seccion.querySelector('.acordeon-body');
      if (!seccion.classList.contains('abierta')) {
        seccion.classList.add('abierta');
      }
      // Recalculamos la altura por si la sección creció
      body.style.maxHeight = body.scrollHeight + 'px';
    });
  });

  // Cálculo inicial al cargar la página (para que no arranque en $0
  // sin sentido, sino que muestre el total real de los datos de ejemplo).
  calcularTotalGeneral();

  // Cada vez que una sección crece/achica por agregar o quitar filas,
  // si está abierta, volvemos a ajustar su altura máxima.
  const observador = new MutationObserver(() => {
    secciones.forEach(seccion => {
      if (seccion.classList.contains('abierta')) {
        const body = seccion.querySelector('.acordeon-body');
        body.style.maxHeight = body.scrollHeight + 'px';
      }
    });
  });

  document.querySelectorAll('.tabla-materiales__cuerpo').forEach(tbody => {
    observador.observe(tbody, { childList: true });
  });


  /* ---------------------------------------------------------
     11) FUNCIÓN AUXILIAR: arma un resumen en texto plano
     con todas las categorías, materiales y el total.
     La usan tanto el botón de Compartir como el de PDF.
     --------------------------------------------------------- */
  function armarResumenTexto() {
    const encabezado = armarEncabezadoTramite();
    let texto = 'PRESUPUESTO ELÉCTRICO\n\n';
    texto += `Electricista: ${encabezado.profesional}\n`;
    texto += `Teléfono: ${encabezado.telefono}\n`;
    texto += `DNI: ${encabezado.dni}\n`;
    texto += `Cliente: ${encabezado.cliente}\n`;
    texto += `Fecha: ${encabezado.fecha}\n\n`;
    let hayContenido = false;

    secciones.forEach(seccion => {
      const filasConValor = Array.from(seccion.querySelectorAll('.fila-material')).filter(fila => {
        const cantidad = parseFloat(fila.querySelector('.input-cantidad').value) || 0;
        return cantidad > 0;
      });

      if (filasConValor.length === 0) return; // sección sin cantidades cargadas: se salta

      hayContenido = true;
      const nombreSeccion = seccion.querySelector('.acordeon-header__titulo').textContent;
      const subtotalSeccion = seccion.querySelector('.acordeon-header__subtotal').textContent;
      texto += `${nombreSeccion} (${subtotalSeccion})\n`;

      filasConValor.forEach(fila => {
        const nombre = fila.querySelector('.input-nombre').value || 'Material sin nombre';
        const cantidad = fila.querySelector('.input-cantidad').value || 0;
        const subtotalFila = fila.querySelector('.subtotal-fila').textContent;
        texto += `  • ${nombre} x${cantidad} = ${subtotalFila}\n`;
      });

      texto += '\n';
    });

    if (!hayContenido) {
      texto += 'No se cargó ningún material todavía.\n\n';
    }

    if (checkIva.checked) {
      texto += 'Incluye IVA (21%)\n';
    }

    texto += `TOTAL FINAL: ${totalFinalEl.textContent}`;
    return texto;
  }


  /* ---------------------------------------------------------
     12) BOTÓN "DESCARGAR PDF"
     Genera un PDF prolijo con jsPDF (no es una foto de la
     pantalla, es texto real: se puede seleccionar y buscar).
     Solo incluye los ítems con cantidad cargada (> 0); los que
     quedaron en 0 no aparecen, para no confundir con la lista
     completa de precios de referencia.
     --------------------------------------------------------- */
  const btnDescargarPdf = document.getElementById('btnDescargarPdf');

  btnDescargarPdf.addEventListener('click', () => {
    // jsPDF se carga desde el <script> del <head>, disponible como window.jspdf
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const margenIzq = 15;
    let y = 20; // posición vertical actual dentro de la hoja
    let hayContenido = false; // se pone en true si al menos un ítem tiene cantidad > 0

    // Función chiquita para no repetir código: escribe una línea y,
    // si ya no entra en la hoja, agrega una página nueva automáticamente.
    function escribirLinea(texto, tamano = 11, negrita = false) {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(tamano);
      doc.setFont(undefined, negrita ? 'bold' : 'normal');
      doc.text(texto, margenIzq, y);
      y += tamano === 11 ? 7 : tamano * 0.6;
    }

    // ----- Encabezado del PDF -----
    const encabezado = armarEncabezadoTramite();
    doc.setTextColor(232, 99, 10); // naranja del sitio
    escribirLinea('PRESUPUESTO ELÉCTRICO', 18, true);
    doc.setTextColor(60, 60, 60);
    y += 1;
    doc.setTextColor(28, 35, 51);
    escribirLinea(`Electricista: ${encabezado.profesional}   |   Tel: ${encabezado.telefono}   |   DNI: ${encabezado.dni}`, 10);
    escribirLinea(`Cliente: ${encabezado.cliente}   |   Fecha: ${encabezado.fecha}`, 10);
    doc.setDrawColor(220, 220, 220);
    doc.line(margenIzq, y, 195, y);
    y += 8;
    doc.setTextColor(20, 20, 20);

    // ----- Una sección por categoría (solo si tiene ítems con cantidad > 0) -----
    secciones.forEach(seccion => {
      // Filtramos primero las filas con cantidad cargada; si no hay
      // ninguna, nos salteamos toda la sección directamente.
      const filasConValor = Array.from(seccion.querySelectorAll('.fila-material')).filter(fila => {
        const cantidad = parseFloat(fila.querySelector('.input-cantidad').value) || 0;
        return cantidad > 0;
      });

      if (filasConValor.length === 0) return; // sección vacía: no se imprime

      hayContenido = true;
      const nombreSeccion = seccion.querySelector('.acordeon-header__titulo').textContent;
      const subtotalSeccion = seccion.querySelector('.acordeon-header__subtotal').textContent;

      y += 2;
      doc.setTextColor(232, 99, 10);
      escribirLinea(`${nombreSeccion} — ${subtotalSeccion}`, 13, true);
      doc.setTextColor(20, 20, 20);

      filasConValor.forEach(fila => {
        const nombre = fila.querySelector('.input-nombre').value || 'Material sin nombre';
        const cantidad = fila.querySelector('.input-cantidad').value || 0;
        const precio = fila.querySelector('.input-precio').value || 0;
        const subtotalFila = fila.querySelector('.subtotal-fila').textContent;

        escribirLinea(`  • ${nombre}   (${cantidad} x $${precio})   =   ${subtotalFila}`, 10);
      });

      y += 3;
    });

    // Si no se cargó ningún ítem, lo avisamos en vez de mostrar un PDF vacío.
    if (!hayContenido) {
      doc.setTextColor(120, 120, 120);
      escribirLinea('No se cargó ningún material todavía.', 11);
      y += 4;
    }

    // ----- Total final -----
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.line(margenIzq, y, 195, y); // línea separadora
    y += 10;

    if (checkIva.checked) {
      escribirLinea('Incluye IVA (21%)', 10);
    }

    doc.setTextColor(28, 35, 51);
    escribirLinea(`TOTAL FINAL: ${totalFinalEl.textContent}`, 16, true);

    // ----- Descargar el archivo -----
    doc.save('presupuesto-electrico.pdf');
  });


  /* ---------------------------------------------------------
     13) BOTÓN "COMPARTIR"
     - En celular (o cualquier navegador que soporte la Web Share
       API): abre el panel nativo del sistema, con WhatsApp,
       Instagram, mail, etc. ya integrados.
     - En PC de escritorio (sin esa API): en vez de ir directo a
       WhatsApp, mostramos nuestro propio menú con varias opciones.
     --------------------------------------------------------- */
  const btnCompartir = document.getElementById('btnCompartir');
  const menuCompartir = document.getElementById('menuCompartir');

  btnCompartir.addEventListener('click', async (evento) => {
    evento.stopPropagation(); // evita que el click "se escape" y cierre el menú al instante
    const texto = armarResumenTexto();

    if (navigator.share) {
      // Celulares y navegadores modernos: panel nativo de compartir.
      try {
        await navigator.share({
          title: 'Presupuesto Eléctrico',
          text: texto
        });
      } catch (error) {
        // El usuario cerró/canceló el panel: no hacemos nada.
      }
    } else {
      // Escritorio: mostramos (o escondemos, si ya estaba abierto)
      // nuestro propio menú de opciones.
      menuCompartir.classList.toggle('visible');
    }
  });

  // Si el usuario hace clic en cualquier lugar fuera del menú, lo cerramos.
  document.addEventListener('click', (evento) => {
    if (!menuCompartir.contains(evento.target) && evento.target !== btnCompartir) {
      menuCompartir.classList.remove('visible');
    }
  });

  // La URL de la página actual, usada por Facebook y X para armar el link.
  // (Si el archivo se abre localmente en el navegador, esta URL no será
  // pública; funciona perfecto una vez que la página esté subida a un hosting).
  const urlPagina = window.location.href;

  // ----- Opción: WhatsApp -----
  document.getElementById('compartirWhatsapp').addEventListener('click', () => {
    const texto = armarResumenTexto();
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    menuCompartir.classList.remove('visible');
  });

  // ----- Opción: Facebook -----
  document.getElementById('compartirFacebook').addEventListener('click', () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlPagina)}`;
    window.open(url, '_blank', 'width=580,height=520');
    menuCompartir.classList.remove('visible');
  });

  // ----- Opción: X / Twitter -----
  document.getElementById('compartirTwitter').addEventListener('click', () => {
    const texto = `Mi presupuesto eléctrico: ${totalFinalEl.textContent}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}&url=${encodeURIComponent(urlPagina)}`;
    window.open(url, '_blank', 'width=580,height=520');
    menuCompartir.classList.remove('visible');
  });

  // ----- Opción: Email -----
  document.getElementById('compartirEmail').addEventListener('click', () => {
    const texto = armarResumenTexto();
    const asunto = 'Presupuesto Eléctrico';
    window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
    menuCompartir.classList.remove('visible');
  });

  // ----- Opción: Copiar texto al portapapeles -----
  const btnCopiar = document.getElementById('compartirCopiar');
  btnCopiar.addEventListener('click', async () => {
    const texto = armarResumenTexto();

    try {
      await navigator.clipboard.writeText(texto);
      // Feedback visual rápido: el texto del botón cambia un instante.
      const textoOriginal = btnCopiar.innerHTML;
      btnCopiar.innerHTML = '<span>✅</span> ¡Copiado!';
      setTimeout(() => {
        btnCopiar.innerHTML = textoOriginal;
        menuCompartir.classList.remove('visible');
      }, 1200);
    } catch (error) {
      alert('No se pudo copiar el texto. Probá con otra opción del menú.');
    }
  });


  /* ---------------------------------------------------------
     14) BOTÓN "IMPRIMIR"
     Antes de imprimir:
       - Abrimos todas las secciones (para que se vea el detalle
         completo aunque estén cerradas en pantalla).
       - Ocultamos SOLO en el papel las filas con cantidad 0 y las
         secciones que no tengan ningún ítem cargado, para no
         imprimir la lista completa de precios de referencia.
     --------------------------------------------------------- */
  const btnImprimir = document.getElementById('btnImprimir');

  function prepararFilasParaImprimir() {
    secciones.forEach(seccion => {
      let seccionTieneAlgo = false;

      seccion.querySelectorAll('.fila-material').forEach(fila => {
        const cantidad = parseFloat(fila.querySelector('.input-cantidad').value) || 0;

        if (cantidad > 0) {
          fila.classList.remove('fila-vacia-print');
          seccionTieneAlgo = true;
        } else {
          // Esta clase solo tiene efecto dentro de @media print (ver CSS):
          // en pantalla la fila sigue viéndose normal.
          fila.classList.add('fila-vacia-print');
        }
      });

      seccion.classList.toggle('seccion-vacia-print', !seccionTieneAlgo);
    });
  }

  btnImprimir.addEventListener('click', () => {
    prepararFilasParaImprimir();

    secciones.forEach(seccion => {
      const body = seccion.querySelector('.acordeon-body');
      seccion.classList.add('abierta');
      body.style.maxHeight = 'none';
    });

    window.print();
  });

});