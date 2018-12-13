/**
 * @param {string} method - Método a invocar.
 * @param {Array|Object} [params] - Parámetros.
 */
function MakeNotify( method, params ) {
  var ret;

// @ifndef NO_PARAMS_CHECK
  if( typeof( method ) != 'string' ) throw TypeError( '"method" must be a string' );
  if( ( params !== null ) && ( params !== undefined ) ) {
    if( ( typeof( params ) != 'object' ) && ( !Array.isArray( params ) ) ) throw TypeError( 'Optional "params" must be Object or Array' );
  }
// @endif

  ret = {
    jsonrpc: '2.0',
    method: method
  };
  if( params ) ret.params = params;

  return ret;
}

/**
 * 
 * @param {number} id - Identificador de la petición.
 * @param {string} method - Nombre del método a invocar.
 * @param {Array|Object} [params] - Parámetros.
 */
function MakeRequest( id, method, params ) {
  var ret;

// @ifndef NO_PARAMS_CHECK
  if( ( id === null ) || ( id === undefined ) ) throw TypeError( 'Required "id" can not be null' );
  if( typeof( method ) != 'string' ) throw TypeError( '"method" must be a string' );
  if( ( params !== null ) && ( params !== undefined ) ) {
    if( ( typeof( params ) != 'object' ) && ( !Array.isArray( params ) ) ) throw TypeError( 'Optional "params" must be Object or Array' );
  }
// @endif

  ret = {
    jsonrpc: '2.0',
    id: id,
    method: method
  };
  if( ( params !== null ) && ( params !== undefined ) ) ret.params = params;

  return ret;
}

/**
 * @param {number} id - Identificador de la petición.
 * @param {*} result - Valor a retornar.
 */
function MakeResult( id, result ) {
  var ret;

  if( ( id === null ) || ( id === undefined ) ) throw TypeError( 'Required "id" can not be null' );

  ret = {
    jsonrpc: '2.0',
    id: id
  };
  if( ( id !== null ) && ( id !== undefined ) ) ret.result = result;

  return result;
}

/**
 * @param {number} id - Identificador de la petición.
 * @param {number} code - Código numérico del error.
 * @param {string} message - Texto del error.
 * @param {*} [data] - Datos adicionales del error.
 */
function MakeError( id, code, message, data ) {
  var ret;

  if( ( id === null ) || ( id === undefined ) ) throw TypeError( 'Required "id" can not be null' );
  if( !Number.isInteger( code ) ) throw TypeError( 'Required "code" must be a integer' );
  if( typeof( message ) != 'string' ) throw TypeError( 'Required "message" must be a string' );

  ret = {
    jsonrpc: '2.0',
    id: id,
    code: code,
    message: message
  };
  if( ( data !== null ) && ( data !== undefined ) ) ret.data = data;

  return ret;
}

/**
 * @param {*} json
 * @param {boolean} [sanitize] - Eliminar atributos no necesarios. Por defecto, 'true'.
 * @returns {string} - 'notify'|'request'|'result'|'error'|Mensaje de error
 */
function GetType( json, sanitize ) {
  var sum = 0;

  if( ( typeof( json ) != 'object' ) || ( json === null ) ) throw TypeError( 'Required "json" must be a Object' );

  if( sanitize !== false ) {
    for( let key in json ) {
      if( json.hasOwnProperty( key ) ) {
        if( key == 'method' ) { ++sum; continue; }
        if( key == 'result' ) { ++sum; continue; }
        if( key == 'error' ) { ++sum; continue; }
        if( key == 'jsonrpc' ) continue;
        if( key == 'id' ) continue;

        delete json[key];
      }
    }
  } else {
    if( 'method' in json ) ++sum;
    if( 'error' in json ) ++sum;
    if( 'result' in json ) ++sum;
  }

  if( ( typeof( json.jsonrpc ) != 'string' ) || ( json.jsonrpc != '2.0' ) ) return 'Required attrib "jsonrpc" missing or invalid';
  if( sum > 1 ) return 'Ambiguous JSONRPC message';
  if( sum < 1 ) return 'Invalid JSONRPC message. No keyword';

  // Común para Notify y Request.
  if( 'method' in json ) {
    if( typeof( json.method ) != 'string' ) return '"method" keyword must be a string';

    if( 'params' in json ) {
      if( ( json.params === null ) || ( json.params === undefined ) ) return 'Keyword "params" can not be null or undefined';
    }
  }

  // Notify.
  if( ( 'method' in json ) && ( !( 'id' in json ) ) ) return 'rpcnotify';  

  // En todos los siguientes casos, se require un 'id'.
  if( !( 'id' in json ) ) return 'Required "id" missing';
  if( ( json.id === null ) || ( json.id === undefined ) ) return '"id" keyword cat not be null';

  // Request.
  if( 'method' in json ) return 'rpcrequest';

  if( 'result' in json ) {
    // Result 
    if( ( json.result === null ) || ( json.result === undefined ) ) return '"result" keyword cat not be null';

    return 'rpcresult';
  }

  // Al llegar aquí, Error.
  if( ( json.error === null ) || ( typeof( json.error ) != 'object' ) ) return '"error" keyword cat not be null';
  if( !Number.isInteger( json.error.code ) ) return 'In Error messages, "error.code" must be a integer';
  if( typeof( json.error.message ) != 'string' ) return 'In Error messages, "error.message" must be a string';
  if( 'data' in json.error ) {
    if( ( json.error.data === null ) || ( json.error.data === undefined ) ) return 'In Error messages, optional "error.data" can not be null';
  }

  return 'rpcerror';
}

module.exports = {
  makeNotify: MakeNotify,
  makeRequest: MakeRequest,
  makeResult: MakeResult,
  makeError: MakeError,
  getType: GetType,
  validTypes: [ 'rpcnotify', 'rpcrequest', 'rpcresult', 'rpcerror' ]
};

