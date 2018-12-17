const { EventEmitter } = require( 'events' );
const Readline = require( 'readline' );
const { exec: Exec, execFile: ExecFile, fork: Fork, spawn: Spawn } = require( 'child_process' );
const JsonRpc = require( './jsonrpc.js' );
const Work = require( './work.js' );

class RpcChild extends EventEmitter {
  get userData( ) { return this.$userData; }
  get killed( ) { return this.$child.killed; }

  /**
   * @param {*} child - Hijo, tal y como lo devuelven las funciones de 'child_process'.
   * @param {*} [userData] - No usado internamente. Para colocar cualquier dato que sea necesario.
   */
  constructor( child, userData ) {
    super( );

    this.$userData = userData;
    this.$child = child;
    this.$stdin = child.stdin;
    this.$stdout = Readline.createInterface( {
      input: child.stdout,
      terminal: false
    } );
    this.$stderr = Readline.createInterface( {
      input: child.stderr,
      terminal: false
    } );
    this.$clientQueue = { };
    this.$serverQueue = { };
    this.$id = 0;

    child.on( 'exit', ( code, signal ) => this.$onChildExit( code, signal ) );
    this.$stdout.on( 'line', ( line ) => this.$onStdout( line ) );
    this.$stderr.on( 'line', ( line ) => this.emit( 'stderr', line, this ) );
  }

  $nextId( ) {
    var retId = ++this.$id;
  
    if( retId == 2147483647 ) {
      this.$id = 1;
      retId = 1;
    }
  
    return retId;
  }
  
  $send( consume, produce, id, jsonObject, queue ) {
    var work = new Work( id );

    if( queue[id] !== undefined ) throw Error( '"id" exists yet' );

    queue[id] = work;

    // Nos suscribimos a los eventos 'timeout' del work.
    work.on( 'timeout', ( type, w ) => this.emit( 'timeout', type, jsonObject, this ) );

    work.write( consume, produce, this.$stdin, JSON.stringify( jsonObject ) );
  }

  $onChildExit( code, signal ) {
    this.clearAll( );
    this.emit( 'exit', code, signal, this );
  }

  // Al recibir una línea desde la salida estandar del hijo.
  $onStdout( line ) {
    var jsonObject,
        rpcType;

    if( line[0] == '{' ) {
      // Supuestamente, es un JSON.
      try {
        jsonObject = JSON.parse( line );
      } catch( err ) {
        rpcType = err.msg;
      }
    } else {
      rpcType = 'Not a JSON';
    }

    // Si no hubo ningún error, obtenemos el tipo del JSONRPC.
    if( rpcType !== undefined ) rpcType = JsonRpc.getType( jsonObject );

    if( !JsonRpc.validTypes.includes( rcpType ) ) {
      // Algún error con el JSON o con el parseo del JSONRPC.
      this.emit( 'stdout', rpcType, line, this );
      return;
    }

    // Al llegar aquí, es un JSONRPC válido.
    if( ( rpcType == 'rpcresult' ) || ( rpcType == 'rpcerror' ) ) {
      // Estos mensajes pasan por la cola.
      let id = jsonObject.id,
          work = this.$clientQueue[id];

      if( work === undefined ) {
        // No tenemos esa id en la cola ¿ Nos llegó tarde ?
        this.emit( 'unexpected', jsonObject, this );
        return;
      }

      // Quitamos los timeouts
      work.finish( );
      delete this.$clientQueue[id];
    }

    // Si es un 'rpcnotify' o un 'rpcrequest', no han pasado por la cola.

    // Todo listo. Emitimos el evento.
    this.emit( rpcType, jsonObject, this );
  }

  // Copia las posibles optiones soportadas.
  // Son todas datos primitivos, por lo que no hay problema.
  // El único dato de tipo 'object' es 'userData'; este se copia igual, para permitir que
  // esté compartido entre esta clase y quien nos llame.
  static $makeRealOptions( opts ) {
    var key,
        ret = { };

    if( ( typeof( opts ) !== 'object' ) || ( opts === null ) ) return { windowsHide: true };

    for( key in opts ) if( Object.hasOwnProperty( key ) ) ret[key] = opts[key];

    ret.windowsHide = true;

    return ret;
  }

  // Mata el hijo, enviando la señal (por defecto, 'SIGTERM'.
  kill( signal ) { $this.$child.kill( signal ); }

  /**
   * Envía un 'notify' al hijo.
   * No se espera respuesta de estos mensajes. Solo tienen timeout para el consume.
   * 
   * @param {number} consume - timeout, en segundos.
   * @param {string} methodName - nombre del método a invocar.
   * @param {*} [args] - Argumentos.
   */
  notify( consume, methodName, args ) {
    var id = this.$nextId( ),
        jsonObject = JsonRpc.makeNotify( methodName, args );

    return this.$send( consume, false, id, jsonObject, this.$clientQueue );
  }

  /**
   * Envía un petición al hijo. Si esperamos respuesta.
   * 
   * @param {number} consume - timeout, en segundos.
   * @param {number} produce - timeout, en segundos.
   * @param {string} methodName - nombre del método a invocar.
   * @param {*} [args] - Argumentos.
   */
  request( consume, produce, methodName, args ) {
    var id = this.$nextId( ),
        jsonObject = JsonRpc.makeRequest( id, methodName, args );

    return this.$send( consume, produce, id, jsonObject, this.$clientQueue );
  }

  /**
   * Envía una respuesta correcta al hijo.
   * 
   * @param {number} consume - timeout, en segundos.
   * @param {*} id - identificador de la solicitud a la que respondemos.
   * @param {*} result - datos enviados en la respuesta.
   */
  result( consume, id, result ) {
    var jsonObject = JsonRpc.makeResult( id, result );

    return this.$send( consume, false, id, jsonObject, this.$serverQueue );
  }

  /**
   * Envía una respuesta de error al hijo.
   * 
   * @param {number} consume - timeout, en segundos.
   * @param {*} id - identificador de la solicitud a la que respondemos.
   * @param {number} code - código de error.
   * @param {string} message - texto del error.
   * @param {*} [data] - datos opcionales a añadir.
   */
  error( consume, id, code, message, data ) {
    var jsonObject = JsonRpc.makeError( id, code, message, data );

    return this.$send( consume, false, id, jsonObject, this.$serverQueue );
  }

  clearAll( ) {
    var key,
        value,
        queue = this.$queue;

    this.$queue = { }
    this.$id = 0;

    for( [ key, value ] of Object.entries( queue ) ) {
      if( queue.hasOwnProperty( key ) ) {
        if( value[0] ) clearTimeout( value[0] );
        if( value[1] ) clearTimeout( value[1] );
      }
    }
  }

  /**
   * 
   * @param {string} command - Orden a ejecutar.
   * @param {*} [options] - Opciones.
   */
  static exec( command, options ) {
    var realOptions = RpcChild.$makeRealOptions( options );

    return new RpcChild( Exec( command, realOptions ), realOptions.userData );
  }

  /**
   * 
   * @param {string} file - Archivo a ejecutar.
   * @param {Array|null} args - Opciones. Si no se usan, ha de ser 'null'
   * @param {*} [options] - Opciones.
   */
  static execFile( file, args, options ) {
    var realOptions = RpcChild.$makeRealOptions( options );

    return new RpcChild( ExecFile( file, args, realOptions ), realOptions.userData );
  }

  /**
   * 
   * @param {string} modulePath - Rutal al arhcivo '.js'.
   * @param {Array|null} args - Argumentos a pasar. Si no se pasa ninguno, ha de ser 'null'.
   * @param {*} [options] - Opciones.
   */
  static fork( modulePath, args, options ) {
    var realOptions = RpcChild.$makeRealOptions( options );

    realOptions.stdio = 'pipe';

    return new RpcChild( Fork( modulePath, args, realOptions ), realOptions.userData );
  }

  /**
   * 
   * @param {string} command - Orden a ejecutar.
   * @param {Array|null} args - Argumentos a pasar. Si no se usa, ha de ser 'null'.
   * @param {*} [options] - Opciones.
   */
  static spawn( command, args, options ) {
    var realOptions = RpcChild.$makeRealOptions( options );

    realOptions.stdio = 'pipe';
    realOptions.detached = false;

    return new RpcChild( Spawn( command, args, realOptions ), realOptions.userData );
  }
};

module.exports = RpcChild
