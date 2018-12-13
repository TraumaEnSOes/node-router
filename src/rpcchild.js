const { EventEmitter } = require( 'events' );
const JsonRpc = require( './jsonrpc.js' );
const { CreateInferface } = require( 'readline' );

class FakeLogger {
  emerg( ) { }
  alert( ) { }
  crit( ) { }
  err( ) { }
  warning( ) { }
  notice( ) { }
  info( ) { }
  debug( ) { }
}

class RpcChild extends EventEmitter {
  /**
   * @param {string} path - Al recibir entradas por 'stdout' o 'stderr', se envia esto como segundo argumento del evento.
   *                        También se envía al logger al recibir logs desde el hijo.
   * @param {*} child - Hijo, tal y como lo devuelven las funciones de 'child_process'.
   * @param {*} logger - Instancia de clase logger, a la que se enviaran los logs.
   */
  constructor( path, child, logger ) {
    if( ( logger === null ) || ( logger == undefined ) ) logger = new FakeLogger( );

    super( );

    this.$child = child;
    this.$stdout = CreateInferface( child.stdout );
    this.$stderr = CreateInterface( child.stderr );
    this.$queue = { };
    this.$path = path;
    this.$logger = logger;
    this.$id = 0;

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

  notify( consume, methodName, args ) {
    var id = this.$nextId,
        jsonObject = JsonRpc.makeNotify( methodName, args ),
        work = [
          consume ? setTimeout( consume * 1000, ( ) => this.$timeoutConsume( id ) ) : false,
          false
        ];
        
    this.$queue[id] = work;
    this.child.stdin.write( jsonObject, ( ) => this.$ontimeConsume( id ) );

    return id;
  }

  request( consume, produce, methodName, args ) {
    var id = this.$nextId( ),
        jsonObject = JsonRpc.makeRequest( methodName, args ),
        work = [
          consume ? setTimeout( consume * 1000, ( ) => this.$timeoutConsume( id ) ) : false,
          produce ? setTimeout( produce * 1000, ( ) => this.$timeoutProduce( id ) ) : false
        ];
  
    this.$queue[id] = work;
    this.$child.stdin.write( jsonObject, ( ) => this.$ontimeConsume( id ) );

    return id;
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

  $ontimeConsume( id ) {
    var work = this.$queue[id];

    if( work[0] ) {
      clearTimeout( work[0] );
      work[0] = false;
    }

    if( !( work[1] ) ) delete this.$queue[id];
  }

  $timeoutConsume( id ) {
    this.$queue[id][0] = false;
    this.emit( 'consumeTimeout', id, this );
  }

  $timeoutProduce( id ) {
    var work = this.$queue[id];

    this.clear( id );
    this.emit( 'produceTimeout', id, this );
  }

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
      this.emit( 'parseError', rpcType );
      return;
    }

    rpcType = JsonRpc.getType( jsonObject );
    if( !JsonRpc.validTypes.includes( rpcType ) ) {
      this.emit( 'parseError', rpcType );
      return;
    }
  
    // Si llegamos aquí, es un JSONRPC válido.
    // Si tiene 'id', la quitamos de la cola.
    if( 'id' in jsonObject ) this.clear( jsonObject.id );

    // Por último, emitimos la señal.
    emit( rpcType, jsonObject, this );
  }

  static exec( command, options ) {
  }

  static execFile( command, args, options ) {
  }

  static fork( modulePath, args, options ) {
  }

  static spawn( command, args, options ) {
  }
};

module.exports = RpcChild
