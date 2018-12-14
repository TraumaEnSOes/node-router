const { EventEmitter } = require( 'events' );
const { CreateInferface } = require( 'readline' );
const { exec: Exec, execFile: ExecFile, fork: Fork, spawn: Spawn } = require( 'child_process' );
const JsonRpc = require( './jsonrpc.js' );

class RpcChild extends EventEmitter {
  get userData( ) { return this.$userData; }
  // Total de mensajes enviados.
  get sends( ) { return this.$sendsCount; }
  // Total de mensajes recibidos.
  get receiveds( ) { return this.$receivedsCount; }
  /**
   * @param {*} child - Hijo, tal y como lo devuelven las funciones de 'child_process'.
   * @param {*} [userData] - No usado internamente. Para colocar cualquier dato que sea necesario.
   */
  constructor( child, userData ) {
    if( ( logger === null ) || ( logger == undefined ) ) logger = new FakeLogger( );

    super( );

    this.$userData = userData;
    this.$stdin = child.stdin;
    this.$stdout = CreateInferface( {
      input: child.stdout,
      terminal: false
    } );
    this.$stderr = CreateInterface( {
      input: child.stderr,
      terminal: false
    } );
    this.$queue = { };
    this.$path = path;
    this.$id = 0;
    this.$sendsCount = 0;
    this.$receivedsCount = 0;

    child.on( 'exit', ( code, signal ) => $onChildExit( code, signal ) );
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

  $send( consume, produce, id, jsonObject ) {
    var work;

    if( id in this.$queue ) throw Error( '"id" exists yet' );
    if( !( consume || produce ) ) throw Error( '"consume" and "produce", both 0' );

    work = [
      consume ? setTimeout( consume * 1000, ( ) => this.$timeoutConsume ) : false,
      produce ? setTimeout( produce * 1000, ( ) => this.$timeoutProduce ) : false
    ];

    this.$queue[id] = work;
    ++this.$sendsCount;
    this.$stdin.write( jsonObject, null, ( ) => this.$ontimeConsume( id ) );
  }

  notify( consume, methodName, args ) {
    var id = this.$nextId,
        jsonObject = JsonRpc.makeNotify( methodName, args );

    return this.$send( consume, 0, id, jsonObject );
  }

  request( consume, produce, methodName, args ) {
    var id = this.$nextId( ),
        jsonObject = JsonRpc.makeRequest( methodName, args );

    return this.$send( consume, produce, id, jsonObject );
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

  // Quita un 'id' de la cola, limpiando sus timeouts.
  clear( id ) {
    var work = this.$queue[id];

    // Si no está en la cola, no hay nada que hacer.
    if( work === undefined ) return;

    // Quitamos los timeouts, si los tenía.
    if( work[0] ) clearTimeout( work[0] );
    if( work[1] ) clearTimeout( work[0] );

    // Y lo quitamos de la cola.
    delete this.$queue[id];
  }

  // Se realizó el 'consume' dentro del plazo.
  $ontimeConsume( id ) {
    var work = this.$queue[id];

    if( work[0] ) {
      clearTimeout( work[0] );
      work[0] = false;
    }

    if( !( work[1] ) ) delete this.$queue[id];
  }

  // 'timeout' del consume. El hijo ha tardado mucho en obtener nuestros datos.
  $timeoutConsume( id ) {
    this.$queue[id][0] = false;
    this.emit( 'consumeTimeout', id, this );
  }

  // 'timeout' del produce. El hijo ha tardado mucho en responder.
  $timeoutProduce( id ) {
    this.clear( id );
    this.emit( 'produceTimeout', id, this );
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

    if( rpcType !== undefined ) {
      // Error al parsear el JSON.
      // Lanzamos la señal.
      this.emit( 'stdout', line, rpcType, this );
      return;
    }

    rpcType = JsonRpc.getType( jsonObject );
    if( !JsonRpc.validTypes.includes( rpcType ) ) {
      // No es un JSONRPC válido.
      this.emit( 'stdout', line, rpcType, this );
      return;
    }
  
    // Si llegamos aquí, es un JSONRPC válido.
    
    if( 'id' in jsonObject ) {
      ++this.$receivedsCount;

      // Si tiene 'id', la quitamos de la cola.
      this.clear( jsonObject.id );
      // Y por último, emitimos la señal.
      emit( rpcType, jsonObject, this );
    } else {
      // No está en la cola. ¿ Llegó fuera de tiempo ?
      this.emit( 'unexpected', jsonObject, this );
    }
  }

  static exec( command, options ) {
    if( ( options === null ) && ( options === undefined ) ) options = { }

    // Sobreescribimos las opciones que necesitamos.
    options.windowsHide = true;

    return new RpcChild( Exec( command, options ), options.userData );
  }

  static execFile( file, args, options ) {
    if( ( options === null ) && ( options === undefined ) ) options = { }

    // Sobreescribimos las opciones que necesitamos.
    options.windowsHide = true;

    return new RpcChild( ExecFile( file, args, options ), options.userData );
  }

  static fork( modulePath, args, options ) {
    if( ( options === null ) && ( options === undefined ) ) options = { }

    // Sobreescribimos las opciones que necesitamos.
    options.windowsHide = true;
    options.stdio = 'pipe';

    return new RpcChild( Fork( modulePath, args, options ), options.userData );
  }

  static spawn( command, args, options ) {
    if( ( options === null ) && ( options === undefined ) ) options = { }

    // Sobreescribimos las opciones que necesitamos.
    options.windowsHide = true;
    options.stdio = 'pipe';
    options.detached = false;

    return new RpcChild( Spawn( command, args, options ), options.userData );
  }
};

module.exports = RpcChild
