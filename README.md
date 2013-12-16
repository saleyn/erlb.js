erlb.js
=======

Javascript binary support of Erlang External Term Format (ETF)

Interface
---------

* <b>Erl.encode(Object)</b> - Encode a Javascript object into ETF, return ArrayBuffer
    suitable for sending via websocket. The object can be a Boolean, Integer, Float,
    String, Array, Associative Array, Object (to be implemented) or an Atom, Binary,
    or Tuple (with the help of Erl.atom(), Erl.binary(), or Erl.tuple(), respectively).
* <b>Erl.decode(ArrayBuffer)</b> - Decode a binary ArrayBuffer into a Javascript object.
* <b>Erl.atom(String)</b> - Create a Javascript object that will be encoded to an Atom.
* <b>Erl.binary(Int8Array)</b> - Create a Javascript object that will be encoded to an Binary.
* <b>Erl.tuple(Array)</b> - Create a Javascript object that will be encoded to a Tuple.
