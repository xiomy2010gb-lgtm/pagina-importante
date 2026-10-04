/* =========================================================
   NOTAS DEL PROFESIONAL - LOGICA (JavaScript)
   Pagina aparte del presupuesto principal. Es un editor de
   texto simple tipo Word: permite negrita, cursiva, listas,
   titulos, etc. Todo lo que se escribe aca se guarda solo en
   este navegador (localStorage), nunca viaja al PDF, a
   "Compartir" ni a la impresion del presupuesto del cliente.
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  const CLAVE_GUARDADO = 'electrocalc_notas_profesional_html';

  const documento = document.getElementById('documentoNotas');
  const estadoGuardado = document.getElementById('estadoGuardado');
  const selectEstilo = document.getElementById('selectEstilo');
  const btnBorrarNotas = document.getElementById('btnBorrarNotas');
  const btnImprimirNotas = document.getElementById('btnImprimirNotas');
  const btnDescargarWord = document.getElementById('btnDescargarWord');


  /* ---------------------------------------------------------
     1) CARGAR EL DOCUMENTO GUARDADO (si había algo escrito antes)
     Guardamos el HTML (no solo texto plano) para no perder el
     formato: negrita, listas, títulos, etc.
     --------------------------------------------------------- */
  const contenidoGuardado = localStorage.getItem(CLAVE_GUARDADO);
  if (contenidoGuardado) {
    documento.innerHTML = contenidoGuardado;
  }


  /* ---------------------------------------------------------
     2) AUTOGUARDADO (con debounce: espera a que el profesional
     deje de escribir medio segundo antes de guardar)
     --------------------------------------------------------- */
  let temporizadorGuardado = null;

  function guardarDocumento() {
    clearTimeout(temporizadorGuardado);
    estadoGuardado.textContent = 'Escribiendo…';
    estadoGuardado.classList.remove('editor-toolbar__estado--ok');

    temporizadorGuardado = setTimeout(() => {
      localStorage.setItem(CLAVE_GUARDADO, documento.innerHTML);
      estadoGuardado.textContent = 'Guardado ✓';
      estadoGuardado.classList.add('editor-toolbar__estado--ok');
    }, 500);
  }

  documento.addEventListener('input', guardarDocumento);


  /* ---------------------------------------------------------
     3) BARRA DE HERRAMIENTAS (negrita, cursiva, listas, etc.)
     Usamos document.execCommand, que es lo más simple para un
     editor "contenteditable" como este: cada botón aplica un
     comando de formato al texto que el profesional seleccionó.
     --------------------------------------------------------- */
  const botonesToolbar = document.querySelectorAll('.editor-toolbar__btn');

  botonesToolbar.forEach(boton => {
    boton.addEventListener('click', () => {
      const comando = boton.dataset.comando;

      documento.focus(); // nos aseguramos de estar escribiendo en el documento
      document.execCommand(comando, false, null);

      // Los botones de lista/alineación se "marcan" como activos
      // mientras el cursor esté dentro de ese tipo de formato.
      actualizarEstadoBotones();
      guardarDocumento();
    });
  });

  // Selector de estilo de párrafo (Normal / Título / Subtítulo)
  selectEstilo.addEventListener('change', () => {
    documento.focus();
    document.execCommand('formatBlock', false, selectEstilo.value);
    guardarDocumento();
  });

  // Marca en celeste los botones cuyo formato está activo en la
  // posición actual del cursor (ej: si estás escribiendo en negrita,
  // el botón "N" se ve resaltado).
  function actualizarEstadoBotones() {
    botonesToolbar.forEach(boton => {
      const comando = boton.dataset.comando;
      // queryCommandState no aplica a "undo", lo salteamos
      if (comando === 'undo') return;

      try {
        const activo = document.queryCommandState(comando);
        boton.classList.toggle('editor-toolbar__btn--activo', activo);
      } catch (error) {
        // Algunos navegadores viejos pueden no soportar el comando: lo ignoramos.
      }
    });
  }

  documento.addEventListener('keyup', actualizarEstadoBotones);
  documento.addEventListener('mouseup', actualizarEstadoBotones);

  // Atajos de teclado típicos de Word (Ctrl+B, Ctrl+I, Ctrl+U)
  documento.addEventListener('keydown', (evento) => {
    const combo = (evento.ctrlKey || evento.metaKey);
    if (!combo) return;

    const tecla = evento.key.toLowerCase();
    if (tecla === 'b') { evento.preventDefault(); document.execCommand('bold'); }
    if (tecla === 'i') { evento.preventDefault(); document.execCommand('italic'); }
    if (tecla === 'u') { evento.preventDefault(); document.execCommand('underline'); }
  });


  /* ---------------------------------------------------------
     3bis) DICTADO POR VOZ (botón 🎤)
     Usa la Web Speech API del navegador para transcribir lo que
     el profesional dice y lo va escribiendo en el documento en
     tiempo real, como si lo estuviera tipeando.
     Funciona en Chrome/Edge; otros navegadores pueden no soportarlo.
     --------------------------------------------------------- */
  const btnGrabar = document.getElementById('btnGrabar');

  // Buscamos la API con sus dos nombres posibles según el navegador.
  const ReconocimientoVoz = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!ReconocimientoVoz) {
    // El navegador no soporta dictado: deshabilitamos el botón y avisamos por qué.
    btnGrabar.disabled = true;
    btnGrabar.title = 'Tu navegador no soporta dictado por voz. Probá con Google Chrome.';
    btnGrabar.style.opacity = '0.4';
    btnGrabar.style.cursor = 'not-allowed';
  } else {

    const reconocimiento = new ReconocimientoVoz();
    reconocimiento.lang = 'es-AR';        // español rioplatense
    reconocimiento.continuous = true;      // sigue escuchando hasta que lo frenemos nosotros
    reconocimiento.interimResults = true;  // nos avisa también lo que va reconociendo "en borrador"

    let grabando = false;          // true mientras el micrófono está activo
    let detenidoManualmente = false; // true solo cuando el profesional aprieta el botón para parar

    // Guardamos el texto original del indicador para poder restaurarlo.
    const textoEstadoOriginal = 'Guardado ✓';

    btnGrabar.addEventListener('click', () => {
      if (grabando) {
        // El profesional quiere parar de dictar.
        detenidoManualmente = true;
        reconocimiento.stop();
      } else {
        // Arranca el dictado. A propósito NO hacemos documento.focus()
        // acá: en el celular, poner el foco en el documento es lo que
        // abre el teclado en pantalla, y no lo queremos mientras se dicta.
        detenidoManualmente = false;
        try {
          reconocimiento.start();
        } catch (error) {
          // Si ya estaba iniciado por algún motivo, lo ignoramos.
        }
      }
    });

    reconocimiento.addEventListener('start', () => {
      grabando = true;
      btnGrabar.classList.add('editor-toolbar__btn--grabando');
      estadoGuardado.textContent = '🎤 Escuchando…';
    });

    /* -----------------------------------------------------
       Inserta texto dentro del documento SIN usar .focus().
       Si había una selección/cursor previo dentro del documento,
       lo respeta; si no, agrega el texto al final. Así evitamos
       que el navegador abra el teclado virtual en el celular. */
    function insertarTextoSinAbrirTeclado(texto) {
      const seleccion = window.getSelection();
      let rango;

      if (seleccion.rangeCount > 0 && documento.contains(seleccion.anchorNode)) {
        // Ya había un cursor puesto adentro del documento: seguimos desde ahí.
        rango = seleccion.getRangeAt(0);
      } else {
        // No hay cursor activo (caso típico en celular): escribimos al final.
        rango = document.createRange();
        rango.selectNodeContents(documento);
        rango.collapse(false);
      }

      const nodoTexto = document.createTextNode(texto);
      rango.insertNode(nodoTexto);

      // Dejamos el "cursor" (la selección) justo después de lo insertado,
      // para que la próxima frase dictada se agregue a continuación.
      rango.setStartAfter(nodoTexto);
      rango.setEndAfter(nodoTexto);
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }

    reconocimiento.addEventListener('result', (evento) => {
      let textoFinal = '';
      let textoParcial = '';

      // event.resultIndex: desde dónde hay resultados nuevos en este evento.
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        if (resultado.isFinal) {
          textoFinal += resultado[0].transcript;
        } else {
          textoParcial += resultado[0].transcript;
        }
      }

      if (textoFinal) {
        insertarTextoSinAbrirTeclado(textoFinal.trim() + ' ');
        guardarDocumento();
      }

      // Mientras habla, mostramos lo que se va reconociendo "en vivo"
      // (todavía no confirmado) en el indicador de estado.
      if (textoParcial) {
        estadoGuardado.textContent = `🎤 ${textoParcial}`;
      }
    });

    reconocimiento.addEventListener('error', (evento) => {
      if (evento.error === 'not-allowed' || evento.error === 'permission-denied') {
        alert('Para dictar por voz necesitás darle permiso al navegador para usar el micrófono.');
      }
      // Otros errores (ej: silencio prolongado) los dejamos pasar: "end" se encarga de reiniciar si hace falta.
    });

    reconocimiento.addEventListener('end', () => {
      grabando = false;
      btnGrabar.classList.remove('editor-toolbar__btn--grabando');

      if (!detenidoManualmente) {
        // El navegador cortó solo (por ejemplo, tras unos segundos de silencio)
        // pero el profesional no apretó "parar": reiniciamos automáticamente
        // para que el dictado se sienta continuo.
        try {
          reconocimiento.start();
        } catch (error) {
          estadoGuardado.textContent = textoEstadoOriginal;
        }
      } else {
        estadoGuardado.textContent = textoEstadoOriginal;
      }
    });
  }


  /* ---------------------------------------------------------
     4) BOTÓN "BORRAR TODO"
     Pide confirmación antes de vaciar el documento completo.
     --------------------------------------------------------- */
  btnBorrarNotas.addEventListener('click', () => {
    if (documento.innerHTML.trim() === '') return; // no hay nada que borrar

    const confirmar = confirm('¿Seguro que querés borrar todo el documento? Esta acción no se puede deshacer.');
    if (confirmar) {
      documento.innerHTML = '';
      localStorage.removeItem(CLAVE_GUARDADO);
      estadoGuardado.textContent = 'Guardado ✓';
      documento.focus();
    }
  });


  /* ---------------------------------------------------------
     5) BOTÓN "IMPRIMIR"
     Imprime solo esta página (no tiene relación con el
     presupuesto ni con sus propios botones de impresión).
     --------------------------------------------------------- */
  btnImprimirNotas.addEventListener('click', () => {
    window.print();
  });


  /* ---------------------------------------------------------
     6) BOTÓN "DESCARGAR COMO WORD"
     Arma un archivo .doc real (Microsoft Word lo abre sin
     problema) con el contenido y el formato del documento.
     No necesita ninguna librería externa.
     --------------------------------------------------------- */
  btnDescargarWord.addEventListener('click', () => {
    const contenidoHtml = documento.innerHTML || '<p>(Documento vacío)</p>';

    // Plantilla mínima que Word reconoce como documento válido.
    const plantillaWord = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>Notas del profesional</title>
        <style>
          body { font-family: Georgia, 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; }
          h2 { font-size: 16pt; }
          h3 { font-size: 13pt; }
        </style>
      </head>
      <body>${contenidoHtml}</body>
      </html>
    `;

    // El BOM ('\ufeff') al principio evita problemas de acentos en Word.
    const blob = new Blob(['\ufeff', plantillaWord], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `notas-profesional-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    URL.revokeObjectURL(url);
  });

});