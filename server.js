"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));

class ClsJugador {
    constructor(Ln_id, Lv_nombre, Lb_esCreador, Ln_puntaje = 0) {
        this.Ln_id = Ln_id;
        this.Lv_nombre = Lv_nombre;
        this.Lb_esCreador = Lb_esCreador;
        this.Ln_puntaje = Ln_puntaje;
    }
}

class ClsSala {
    constructor(Ln_id) {
        this.Ln_id = Ln_id;
        this.jugadores = [];
        this.Lv_preguntaActual = null;
        this.Ln_indicePregunta = 0;
        this.Lb_juegoIniciado = false;
        this.preguntasRealizadas = [];
    }
}

class ClsRespuesta {
    constructor(Lv_texto, Lb_esCorrecta) {
        this.Lv_texto = Lv_texto;
        this.Lb_esCorrecta = Lb_esCorrecta;
    }
}

class ClsPregunta {
    constructor(Lv_categoria, Ln_nivel, Lv_pregunta, Lv_respuestas, Lv_imagen) {
        this.Lv_categoria = Lv_categoria;
        this.Ln_nivel = Ln_nivel;
        this.Lv_pregunta = Lv_pregunta;
        this.Lv_respuestas = Lv_respuestas;
        this.Lv_imagen = Lv_imagen;
    }
}

class ClsServidorTrivia {
    constructor() {
        this.Ln_puerto = process.env.PORT || 5000; // Puerto por defecto
        this.Gv_salas = {};
        this.Gv_preguntas = [];
        this.Lv_app = (0, express_1.default)();
        this.Gv_servidor = http_1.default.createServer(this.Lv_app);
        this.Gv_io = new socket_io_1.Server(this.Gv_servidor, {
            cors: {
                origin: "*", // Permitir todas las conexiones CORS
                methods: ["GET", "POST"],
            },
        });

        // Servir archivos estáticos
        this.Lv_app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));

        this.inicializarMiddlewares();
        this.inicializarEventosSocket();
        this.cargarPreguntas();
    }

    inicializarMiddlewares() {
        this.Lv_app.use((0, cors_1.default)());
    }

    inicializarEventosSocket() {
        this.Gv_io.on("connection", (Lv_socket) => {
            console.log("Un usuario conectado");
            Lv_socket.on("crearSala", (Lv_datos) => {
                this.manejarCrearSala(Lv_socket, Lv_datos);
            });
            Lv_socket.on("unirseSala", (Lv_datos) => {
                this.manejarUnirseSala(Lv_socket, Lv_datos);
            });
            Lv_socket.on("enviarMensaje", (Lv_datos) => {
                this.manejarEnviarMensaje(Lv_socket, Lv_datos);
            });
            Lv_socket.on("volverAlChat", (Lv_datos) => {
                this.manejarVolverAlChat(Lv_socket, Lv_datos.Lv_sala);
            });
            Lv_socket.on("iniciarJuego", (Ln_idSala) => {
                this.manejarIniciarJuego(Lv_socket, Ln_idSala);
            });
            Lv_socket.on("enviarRespuesta", (Lv_datos) => {
                this.manejarEnviarRespuesta(Lv_socket, Lv_datos);
            });
            Lv_socket.on("salirDeSala", (Lv_datos) => {
                this.manejarSalirDeSala(Lv_socket, Lv_datos);
            });
            Lv_socket.on("disconnect", () => {
                this.manejarDesconexion(Lv_socket);
            });
        });
    }

    manejarCrearSala(Lv_socket, Lv_datos) {
        const { Lv_nombreUsuario, Lv_sala } = Lv_datos;
        console.log(`${Lv_nombreUsuario} está creando la sala ${Lv_sala}`);
        if (this.Gv_salas[Lv_sala]) {
            Lv_socket.emit('salaYaExiste');
            return;
        }
        const Lv_jugador = new ClsJugador(Lv_socket.id, Lv_nombreUsuario, true);
        this.Gv_salas[Lv_sala] = new ClsSala(Lv_sala);
        this.Gv_salas[Lv_sala].jugadores.push(Lv_jugador);
        Lv_socket.join(Lv_sala);
        Lv_socket.emit('salaUnida', {
            jugadores: this.Gv_salas[Lv_sala].jugadores,
            Lb_esCreador: true
        });
        console.log(`Sala ${Lv_sala} creada`);
    }

    manejarUnirseSala(Lv_socket, Lv_datos) {
        const { Lv_nombreUsuario, Lv_sala } = Lv_datos;
        console.log(`${Lv_nombreUsuario} está intentando unirse a la sala ${Lv_sala}`);
        if (!this.Gv_salas[Lv_sala]) {
            Lv_socket.emit('salaNoEncontrada');
            return;
        }
        if (this.Gv_salas[Lv_sala].Lb_juegoIniciado) {
            Lv_socket.emit('juegoEnProgreso', "La sala ya está en juego");
            return;
        }
        const Lb_nombreExistente = this.Gv_salas[Lv_sala].jugadores.some(jugador => jugador.Lv_nombre === Lv_nombreUsuario);
        if (Lb_nombreExistente) {
            Lv_socket.emit('nombreUsuarioExistente', "Ya existe un jugador con ese nombre en la sala");
            return;
        }
        const Lv_jugador = new ClsJugador(Lv_socket.id, Lv_nombreUsuario, false);
        this.Gv_salas[Lv_sala].jugadores.push(Lv_jugador);
        Lv_socket.join(Lv_sala);
        Lv_socket.emit('salaUnida', {
            jugadores: this.Gv_salas[Lv_sala].jugadores,
            Lb_esCreador: false
        });
        this.Gv_io.to(Lv_sala).emit('jugadorUnido', this.Gv_salas[Lv_sala].jugadores);
        console.log(`La sala ${Lv_sala} ahora tiene ${this.Gv_salas[Lv_sala].jugadores.length} jugadores`);
    }

    manejarEnviarMensaje(Lv_socket, Lv_datos) {
        console.log(`Mensaje en la sala ${Lv_datos.Lv_sala} de ${Lv_datos.Lv_nombreUsuario}: ${Lv_datos.Lv_mensaje}`);
        this.Gv_io.to(Lv_datos.Lv_sala).emit('mensajeChat', { Lv_nombreUsuario: Lv_datos.Lv_nombreUsuario, Lv_mensaje: Lv_datos.Lv_mensaje });
    }

    manejarIniciarJuego(Lv_socket, Ln_idSala) {
        console.log(`Intentando iniciar el juego en la sala ${Ln_idSala}`);
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala && !Lv_sala.Lb_juegoIniciado) {
            if (Lv_sala.jugadores.length < 2) {
                console.log(`No hay suficientes jugadores para iniciar el juego en la sala ${Ln_idSala}`);
                Lv_socket.emit('jugadoresInsuficientes', 'Se necesitan al menos 2 jugadores para iniciar el juego.');
                return;
            }
            Lv_sala.Lb_juegoIniciado = true;
            Lv_sala.preguntasRealizadas = [];
            Lv_sala.jugadores.forEach(Lv_jugador => {
                Lv_jugador.Ln_puntaje = 0;
            });
            this.Gv_io.to(Ln_idSala).emit('juegoIniciado');
            this.Gv_io.to(Ln_idSala).emit('actualizarPuntajes', Lv_sala.jugadores);
            this.enviarSiguientePregunta(Ln_idSala);
        }
    }

    enviarSiguientePregunta(Ln_idSala) {
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala && Lv_sala.preguntasRealizadas.length < 10) {
            let Ln_indicePregunta;
            do {
                Ln_indicePregunta = Math.floor(Math.random() * this.Gv_preguntas.length);
            } while (Lv_sala.preguntasRealizadas.includes(Ln_indicePregunta));

            Lv_sala.preguntasRealizadas.push(Ln_indicePregunta);
            const Lv_pregunta = this.Gv_preguntas[Ln_indicePregunta];
            Lv_sala.Lv_preguntaActual = Lv_pregunta;
            this.Gv_io.to(Ln_idSala).emit('nuevaPregunta', Lv_pregunta);
            console.log(`Pregunta enviada a la sala ${Ln_idSala}: ${Lv_pregunta.Lv_pregunta}`);
        } else {
            this.finalizarJuego(Ln_idSala);
        }
    }

    manejarEnviarRespuesta(Lv_socket, Lv_datos) {
        const Lv_sala = this.Gv_salas[Lv_datos.Ln_idSala];
        const Lv_respuestaElegida = Lv_datos.Lv_respuestaElegida;
        const Lv_preguntaActual = Lv_sala.Lv_preguntaActual;
        const Lv_respuestaCorrecta = Lv_preguntaActual.Lv_respuestas.find(res => res.Lb_esCorrecta).Lv_texto;

        if (Lv_respuestaElegida === Lv_respuestaCorrecta) {
            const Lv_jugador = Lv_sala.jugadores.find(jugador => jugador.Ln_id === Lv_socket.id);
            Lv_jugador.Ln_puntaje++;
            this.Gv_io.to(Lv_datos.Ln_idSala).emit('respuestaCorrecta', {
                Lv_nombreUsuario: Lv_jugador.Lv_nombre,
                Ln_puntaje: Lv_jugador.Ln_puntaje
            });
        } else {
            this.Gv_io.to(Lv_datos.Ln_idSala).emit('respuestaIncorrecta', {
                Lv_nombreUsuario: Lv_sala.jugadores.find(jugador => jugador.Ln_id === Lv_socket.id).Lv_nombre,
                Lv_respuestaCorrecta
            });
        }
        this.enviarSiguientePregunta(Lv_datos.Ln_idSala);
    }

    finalizarJuego(Ln_idSala) {
        const Lv_sala = this.Gv_salas[Ln_idSala];
        if (Lv_sala) {
            Lv_sala.Lb_juegoIniciado = false;
            this.Gv_io.to(Ln_idSala).emit('finDelJuego', Lv_sala.jugadores);
            delete this.Gv_salas[Ln_idSala]; // Eliminar la sala
            console.log(`Juego finalizado en la sala ${Ln_idSala}`);
        }
    }

    manejarSalirDeSala(Lv_socket, Lv_datos) {
        const Lv_sala = this.Gv_salas[Lv_datos.Lv_sala];
        if (Lv_sala) {
            Lv_sala.jugadores = Lv_sala.jugadores.filter(jugador => jugador.Ln_id !== Lv_socket.id);
            Lv_socket.leave(Lv_datos.Lv_sala);
            this.Gv_io.to(Lv_datos.Lv_sala).emit('jugadorSalio', Lv_sala.jugadores);
            console.log(`Jugador ${Lv_datos.Lv_nombreUsuario} ha salido de la sala ${Lv_datos.Lv_sala}`);
        }
    }

    manejarDesconexion(Lv_socket) {
        for (const sala in this.Gv_salas) {
            const Lv_sala = this.Gv_salas[sala];
            Lv_sala.jugadores = Lv_sala.jugadores.filter(jugador => jugador.Ln_id !== Lv_socket.id);
            this.Gv_io.to(sala).emit('jugadorSalio', Lv_sala.jugadores);
            console.log(`Jugador desconectado de la sala ${sala}`);
        }
    }

    cargarPreguntas() {
        const Lv_rutaArchivo = path_1.default.join(__dirname, 'preguntas.json');
        fs_1.default.readFile(Lv_rutaArchivo, 'utf8', (error, datos) => {
            if (error) {
                console.error("Error al cargar el archivo de preguntas:", error);
                return;
            }
            this.Gv_preguntas = JSON.parse(datos);
            console.log("Preguntas cargadas correctamente");
        });
    }

    iniciarServidor() {
        this.Gv_servidor.listen(this.Ln_puerto, () => {
            console.log(`Servidor escuchando en el puerto ${this.Ln_puerto}`);
        });
    }
}

const servidorTrivia = new ClsServidorTrivia();
servidorTrivia.iniciarServidor();
