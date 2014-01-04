erlb.js
=======

Javascript binary support of Erlang External Term Format (ETF)

Installation
------------

git clone https://github.com/saleyn/erlb.js.git

Include erlb.js to your project.

Interface
---------

* <b>Erl.encode(Object)</b> - Encode a Javascript object into ETF, return ArrayBuffer
    suitable for sending via websocket. The object can be a Boolean, Integer, Float,
    String, Array, Object (treated as a proplist) or an Atom, Binary,
    or Tuple (with the help of Erl.atom(), Erl.binary(), or Erl.tuple(), respectively).
* <b>Erl.decode(ArrayBuffer)</b> - Decode a binary ArrayBuffer into a Javascript object.
* <b>Erl.equals(Obj1, Obj2)</b> - Compare Obj1 and Obj2 for equality.
* <b>Erl.toString(Obj)</b> - Print a Javascript object in the Erlang notation.
* <b>Erl.atom(String)</b> - Create a Javascript object that will be encoded to an Atom.
* <b>Erl.binary(UInt8Array)</b> - Create a Javascript object that will be encoded to an Binary.
* <b>Erl.tuple(Array)</b> - Create a Javascript object that will be encoded to a Tuple.
* <b>Erl.pid(Node, Id, Ser, Creation)</b> - Create a Javascript object that will be encoded to a Pid.
* <b>Erl.ref(Node, Creation, IDs)</b> - Create a Javascript object that will be encoded to a Ref.
* <b>Erl.toArrayBuffer(Array)</b> - Convert array of bytes to a binary buffer.
* <b>Erl.timestampToTuple(Int)</b> - Convert a timestamp (number of ms since epoch) to
    {MegaSec, Sec, MicroSec} tuple.
* <b>Erl.dateToTuple(Date)</b> - Convert a Javascript Date to
    {MegaSec, Sec, MicroSec} tuple.

The library natively understands the following Javascript types:

* Number (integer, float)
* String
* Boolean
* Array (Erlang list)
* Object (Erlang proplists)

Testing
-------

You can use provided bin/simple_http_server to serve the content of the current directory
to a web browser:

```shell
$ bin/simple_http_server 8000
```
Point your browser to http://localhost:8000/erlb-test.html.
The page automatically runs all unit tests defined in the erlb-test.js script.

Author
------

Serge Aleynikov &lt;saleyn at gmail dot com&gt;

License
-------

BSD License (see included LICENSE file)
