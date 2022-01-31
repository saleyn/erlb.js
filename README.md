# erlb.js #

Javascript binary support of Erlang External Term Format (ETF)

## Installation ##

git clone https://github.com/saleyn/erlb.js.git

Include erlb.js to your project.

## Interface ##

* <b>Erl.encode(obj, opts)</b> - Encode a Javascript object into ETF, return ArrayBuffer
    suitable for sending via websocket. The object can be a Boolean, Integer, Float,
    String, Array, Object (treated as a proplist) or an Atom, Binary,
    or Tuple (with the help of Erl.atom(), Erl.binary(), or Erl.tuple(), respectively).
    The `opts` argument is optional and may contain the following settings:

    | Value      | Values                   | Default  | Description                                   |
    |------------|--------------------------|----------|-----------------------------------------------|
    | mapKeyType | 'atom'/'binary'/'string' | 'binary' | Encode object's map keys using this data type |
      
* <b>Erl.decode(arrayBuffer)</b> - Decode a binary ArrayBuffer into a Javascript object.
* <b>Erl.equals(obj1, obj2)</b> - Compare Obj1 and Obj2 for equality.
* <b>Erl.toString(obj, opts)</b> - Print a Javascript object in the Erlang notation.
    The `opts` argument is optional and may contain the following settings:

    | Value      | Values                   | Default  | Description                                   |
    |------------|--------------------------|----------|-----------------------------------------------|
    | compact    | true/false               | false    | Print binaries in compact form (using backticks instead of `<<"">>` enclosures |
 
* <b>Erl.atom(string)</b> - Create a Javascript object that will be encoded to an Atom.
* <b>Erl.binary(uInt8Array)</b> - Create a Javascript object that will be encoded to an Binary.
* <b>Erl.tuple(array)</b> - Create a Javascript object that will be encoded to a Tuple.
* <b>Erl.pid(node, id, ser, creation)</b> - Create a Javascript object that will be encoded to a Pid.
* <b>Erl.ref(node, creation, ids)</b> - Create a Javascript object that will be encoded to a Ref.

The library natively understands the following Javascript types:

* Number (integer, float)
* String
* Boolean
* Array (Erlang list)
* Object (Erlang proplists)

### Utility Functions ###

* <b>Erl.toArrayBuffer(array)</b> - Convert array of bytes to a binary buffer.
* <b>Erl.bufferToArray(arrayBuffer)</b> - Convert a binary buffer to an array of bytes.
* <b>Erl.timestampToTuple(int)</b> - Convert a timestamp (number of ms since epoch) to
    {megaSec, sec, microSec} tuple.
* <b>Erl.dateToTuple(date)</b> - Convert a Javascript Date to
    {megaSec, sec, microSec} tuple.

## Testing ##

You can use provided bin/simple_http_server to serve the content of the current directory
to a web browser:

```shell
$ bin/simple_http_server 8000
```
Point your browser to http://localhost:8000/erlb-test.html.
The page automatically runs all unit tests defined in the erlb-test.js script.

## Author ##

Serge Aleynikov &lt;saleyn at gmail dot com&gt;

## License ##

BSD License (see included LICENSE file)
