// vim:ts=2:sw=2:et
//
// erlb.js
// =======
// Copyright (c) 2013 Serge Aleynikov <saleyn@gmail.com>
// See BSD for licensing information.
// This project originated from Bert (https://github.com/rustyio/BERT-JS)
// but ended up being a rewrite.

// erlb.js is a Javascript implementation of Erlang Binary External Term Format.
// http://github.com/saleyn/erlb.js
//
// For future integration:
// BigInteger: https://github.com/silentmatt/javascript-biginteger

//-----------------------------------------------------------------------------
// - CLASSES -
//-----------------------------------------------------------------------------

function Erl() {}

function ErlObject() {}
ErlObject.prototype.type        = 'erl';
ErlObject.prototype.toString    = function() { return this.type; }
ErlObject.prototype.extend      = function(child, type) {
    const f = function() {};
    f.prototype = ErlObject.prototype;
    child.prototype = new f();
    child.prototype.constructor = child;
    child.prototype.type = type;
}


function ErlAtom(s) { this.value = s; }

ErlObject.prototype.extend(ErlAtom, 'atom');
ErlAtom.prototype.equals     = function(a) { return a instanceof ErlAtom && this.value === a.value; }
ErlAtom.prototype.encodeSize = function()  { return 3 + Math.min(255, this.value.length); }
ErlAtom.prototype.toString   = function()  {
    return (!this.value.length || this.value[0] < "a" || this.value[0] > "z")
         ?  "'" + this.value + "'" : this.value;
}

function ErlBinary(arr) {
    if (!(arr instanceof Array))
        throw new Error("Unsupported binary data type: " + Erl.getClassName(arr));
    this.value = arr;
}
ErlObject.prototype.extend(ErlBinary, 'binary');
ErlBinary.prototype.equals      = function(a) { return a instanceof ErlBinary && this.value.equals(a.value); }
ErlBinary.prototype.encodeSize  = function()  { return 1 + 4 + this.value.length; }
ErlBinary.prototype.toString    = function()  {
    const a = this.value;
    const printable = a.length > 0 && a.every((i) => i > 30 && i < 127);
    const body = printable ? a.map(i => String.fromCharCode(i)).join('') : a.join(',');
    return `<<${printable ? '"':''}${body}${printable ? '"':''}>>`
};

function ErlTuple(arr) {
    this.value  = arr;
    this.length = arr === undefined ? 0 : arr.length;
}
ErlObject.prototype.extend(ErlTuple, 'tuple');
ErlTuple.prototype.equals       = function(a) { return a instanceof ErlTuple && this.value.equals(a.value); }
ErlTuple.prototype.encodeSize   = function()  {
    return this.value.reduce(
        (s,i) => s + Erl.encode_size(i),
        1 + (this.length < 256 ? 1 : 4));
ErlTuple.prototype.toString     = function() {
    return "{" + this.value.map((e) => Erl.toString(e)).join(',') + "}";
}
ErlTuple.prototype.toDate       = function() { return new Date(this.toTimestamp()); }
ErlTuple.prototype.toTimestamp  = function() {
    if (length !== 3) return -1;
    const n = value[0] * 1000000000 + value[1] * 1000 + value[2] / 1000;
    return isNaN(n) ? -1 : n;
};


function ErlMap(obj) {
    if (obj instanceof ErlMap)
        this.value = obj.value.deepClone()
    else if (obj instanceof Object)
        this.value = obj
    else
        throw new Error('ErlMap must be given an object!');
}
ErlObject.prototype.extend(ErlMap, 'map');
ErlMap.prototype.equals = function(a) {
    return a instanceof ErlTuple && this.value.equals(a.value);
}
ErlMap.prototype.encodeSize = function() {
    return this.value.reduce((s,i) => s + Erl.encode_size(i), 1 + 4);
}
ErlMap.prototype.toString   = function() {
    return "#{" + Object.keys(this.value).map(k => `${k} => ${Erl.toString(this.value[k])}`).join(',') + "}";
}

function ErlPid(Node, Id, Serial, creation) {
    if (typeof(Node) === 'string')
        Node = new ErlAtom(Node);
    else if (!(Node instanceof ErlAtom))
        throw new Error("Node argument must be an atom!");

    this.node = Node;
    this.num  = (((Id & 0x7fff) << 15)
              | ((Serial & 0x1fff) << 2)
              | (creation & 0x3)) & 0x3fffFFFF;
}
ErlObject.prototype.extend(ErlPid, 'pid');
ErlPid.prototype.equals     = function(a) {
    return a instanceof ErlPid && this.node.equals(a.node) && this.num === a.num;
}
ErlPid.prototype.encodeSize = function() { return 1 + this.node.encodeSize() + 9; }
ErlPid.prototype.toString   = function() {
    return "#pid{" + this.node + ","  +
            (this.num >> 15) + "," +
            ((this.num >> 2) & 0x1fff) + "}";
}

function ErlRef(Node, creation, IDs) {
    if (typeof(Node) === 'string')
        Node = new ErlAtom(Node);
    else if (!(Node instanceof ErlAtom))
        throw new Error("Node argument must be an atom!");
    if (!(IDs instanceof Array) || IDs.length > 3)
        throw new Error("Reference IDs must be an array of length <= 3!");
    this.node = Node;
    this.creation = creation & 0x3;
    this.ids = IDs;
}
ErlObject.prototype.extend(ErlRef, 'ref');
ErlRef.prototype.equals     = function(a) {
    return a instanceof ErlRef && this.node.equals(a.node)
        && this.creation === a.creation
        && this.ids.equals(a.ids);
}
ErlRef.prototype.encodeSize = function() {
    return 1 + 2 + this.node.encodeSize() + 4*this.ids.length + 1;
}
ErlRef.prototype.toString   = function() {
    return `"#ref{${this.node.toString() + (this.ids.length ? this.ids.map(i => `,${i}`).join('') : '')}}`;
}

function ErlVar(Name, type) {
    this.valueType = type;
    this.name = Name;
}
ErlObject.prototype.extend(ErlVar, 'binary');
ErlVar.prototype.equals     = function(a) { return false;
ErlVar.prototype.encodeSize = ()  => { throw new Error("Cannot encode variables!"); }
ErlVar.prototype.toString   = function()  => {
    let tp;
    switch (this.valueType) {
        case Erl.Enum.ATOM:        tp = "::atom()";    break;
        case Erl.Enum.BINARY:      tp = "::binary()";  break;
        case Erl.Enum.ErlBoolean:  tp = "::bool()";    break;
        case Erl.Enum.ErlByte:     tp = "::byte()";    break;
        case Erl.Enum.ErlDouble:   tp = "::double()";  break;
        case Erl.Enum.ErlLong:     tp = "::int()";     break;
        case Erl.Enum.ErlList:     tp = "::list()";    break;
        case Erl.Enum.ErlPid:      tp = "::pid()";     break;
        case Erl.Enum.ErlPort:     tp = "::port()";    break;
        case Erl.Enum.ErlRef:      tp = "::ref()";     break;
        case Erl.Enum.ErlString:   tp = "::string()";  break;
        case Erl.Enum.ErlTuple:    tp = "::tuple()";   break;
        case Erl.Enum.ErlVar:      tp = "::var()";     break;
        default:                   tp = "";            break;
    }
    return this.name + tp;
};

//-----------------------------------------------------------------------------
// - INTERFACE -
//-----------------------------------------------------------------------------

Erl.prototype.encode = function (obj) {
    var n = 1 + this.encode_size(obj);
    var b = new ArrayBuffer(n);
    var d = new DataView(b)
    d.setUint8(0, this.Enum.VERSION);
    var v = this.encode_inner(obj, d, 1);
    if (v.offset !== n)
        throw new Error("Invalid size of encoded buffer: " + v.offset + " expected: " + n);
    return b;
};

Erl.prototype.decode = function (buffer) {
    var dv = new DataView(buffer, 0);
    if (dv.getUint8(0) !== this.Enum.VERSION) {
        throw new Error("Not a valid Erlang term.");
    }
    var obj = this.decode_inner({data: dv, offset: 1});
    if (obj.offset !== buffer.byteLength) {
        throw new Error("Erlang term buffer has unused " +
                        buffer.byteLength - obj.offset + " bytes");
    }
    return obj.value;
};

Erl.prototype.equals = function () {
    var a = arguments[0];
    var b = arguments.length > 1 ? arguments[1] : this;
    if (a === b)
        return true;
    if (ErlObject.prototype.isPrototypeOf(a))
        return a.equals(b)
            || (a instanceof ErlTuple && b instanceof Date && a.toTimestamp() === b.getTime());

    if (a instanceof Date && b instanceof ErlTuple)
        return b.toTimestamp() === a.getTime();
    if (a instanceof Array)
        return b instanceof Array && a.equals(b);

    // Compare two objects for equality
    if (a instanceof Object != b instanceof Object)
        return false;

    for (let k in a) if (!(k in b)) return false;
    for (let k in b) if (!(k in a)) return false;
    for (let k in a) {
        var av = a[k];
        var bv = b[k];
        if (!Erl.equals(av, bv))
            return false;
    }
    return true;
}

Erl.prototype.toString = function(obj) {
    if (obj === undefined)  return "undefined";
    if (obj === null)       return "null";

    switch (typeof(obj)) {
        case 'number':  return obj.toString();
        case 'boolean': return obj.toString();
        case 'string':  return '"' + obj.toString() + '"';
    }
    if (ErlObject.prototype.isPrototypeOf(obj))
        return obj.toString();
    if (obj instanceof Array) {
        return '[' + obj.map((e) => Erl.toString(e)).join(",") + ']';
    }

    return '['
        + Object.keys(obj).map((k) => `{${k},${Erl.toString(obj[k])}}`).join(",")
        + ']';
}

Erl.prototype.atom   = function(obj) { return new ErlAtom(obj);   }
Erl.prototype.binary = function(obj) { return new ErlBinary(obj); }
Erl.prototype.tuple  = function()    {
    var a = new Array(arguments.length);
    for (let i=0, n = arguments.length; i < n; ++i)
        a[i] = arguments[i];
    return new ErlTuple(a);
};

Erl.prototype.pid = function(Node, Id, Serial, creation) { return new ErlPid(Node, Id, Serial, creation); }
Erl.prototype.ref = function(Node, creation, IDs)        { return new ErlRef(Node, creation, IDs); }
Erl.prototype.map = function(obj)                        { return new ErlMap(obj); }

Erl.prototype.toArrayBuffer = function(a) {
    var b = new ArrayBuffer(a.length);
    var d = new DataView(b);
    for (let i=0, n=a.length; i < n; ++i)
        d.setUint8(i, a[i]);
    return b;
}

Erl.prototype.bufferToArray = function(b) {
    var d = new DataView(b);
    var r = new Array(d.byteLength);
    for (let i=0, n=d.byteLength; i < n; ++i)
        r[i] = d.getUint8(i);
    return r;
}

//-----------------------------------------------------------------------------
// - ENCODING -
//-----------------------------------------------------------------------------

// See: https://www.erlang.org/doc/apps/erts/erl_ext_dist.html
// See: https://github.com/erlang/otp/blob/master/lib/erl_interface/include/ei.h#L137
Erl.prototype.Enum = {
    VERSION         : 131,
    SMALL_ATOM      : 115, // 's'
    ATOM            : 100, // 'd'
    ATOM_UTF8       : 118, // 'v'
    BINARY          : 109, // 'm'
    BIT_BINARY      : 77,  // 'M'
    SMALL_INTEGER   : 97 , // 'a'
    INTEGER         : 98 , // 'b'
    SMALL_BIG       : 110, // 'n'
    LARGE_BIG       : 111, // 'o'
    FLOAT           : 99 , // 'c'
    NEW_FLOAT       : 70 , // 'F'
    STRING          : 107, // 'k'
    PORT            : 102, // 'f'
    V4_PORT         : 120, // 'x'
    NEW_PORT        : 89,  // 'Y'
    PID             : 103, // 'g'
    SMALL_TUPLE     : 104, // 'h'
    LARGE_TUPLE     : 105, // 'i'
    LIST            : 108, // 'l'
    MAP             : 116, // 't'
    REFERENCE       : 101, // 'e'
    NEW_REFERENCE   : 114, // 'r'
    NEWER_REFERENCE : 90,  // 'Z'
    NIL             : 106, // 'j'
    //---- Custom --------
    TUPLE           : 104, // SMALL_TUPLE
    DOUBLE          : 70,  // NEW_FLOAT,
    BYTE            : 97,  // SMALL_INTEGER,
    BOOLEAN         : 254,
    VAR             : 255,
    ZERO            : 0
}

Erl.prototype.Encoding = {
    ASCII  : 1,
    LATIN1 : 2,
    UTF8   : 4,
}

Erl.prototype.encode_size = function(obj) {
    switch (typeof(obj)) {
        case "number":      return this.encode_number_size(obj);
        case "string":      return this.encode_string_size(obj);
        case "boolean":     return obj ? 7 : 8; // Atom "true" or "false"
        case "undefined":   return this.atom("undefined").encodeSize();
    }
    if (obj === null || obj === undefined)
        return this.atom(String(obj)).encodeSize();
    switch (obj.type) {
        case "atom":        return obj.encodeSize();
        case "tuple":       return obj.encodeSize();
        case "binary":      return obj.encodeSize();
        case "pid":         return obj.encodeSize();
        case "ref":         return obj.encodeSize();
        case "map":         return obj.encodeSize();
    }
    var s = this.getClassName(obj);
    return s.indexOf("Array") < 0
        ? this.encode_assoc_array_size(obj) : this.encode_array_size(obj);
};

Erl.prototype.encode_inner = function(obj, dataView, offset) {
    const func = 'encode_' + (obj instanceof Object ? 'map' : typeof(obj));
    return this[func](obj, dataView, offset);
};

Erl.prototype.encode_object = function(obj, dv, offset) {
    if (obj === null)
        return this.encode_inner(this.atom("null"), dv, offset);

    switch (obj.type) {
        case "atom":    return this.encode_atom(obj, dv, offset);
        case "binary":  return this.encode_binary(obj, dv, offset);
        case "tuple":   return this.encode_tuple(obj, dv, offset);
        case "ref":     return this.encode_ref(obj, dv, offset);
        case "pid":     return this.encode_pid(obj, dv, offset);
        case "map":     return this.encode_map(obj, dv, offset);
    }

    var s = this.getClassName(obj);
    if (s.indexOf("Array") != -1)   return this.encode_array(obj, dv, offset);

    // Treat the object as an associative array
    return this.encode_assoc_array(obj, dv, offset);
};

Erl.prototype.encode_undefined = function(obj, dv, offset) {
    return this.encode_atom(this.atom("undefined"), dv, offset);
}

Erl.prototype.encode_string_size = function(obj) {
    return 1 + 2 + obj.length; // FIXME: implement encoding for length > 0xFF
}
Erl.prototype.encode_string = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.STRING);
    dv.setUint16(offset, obj.length); // FIXME: check length > 0xFF
    offset += 2;
    for (let i = 0, n = obj.length; i < n; ++i)
        dv.setUint8(offset++, obj.charCodeAt(i));
    return { data: dv, offset: offset };
};

Erl.prototype.encode_boolean = function(obj, dv, offset) {
    return this.encode_atom(new ErlAtom(obj ? "true" : "false"), dv, offset);
}

Erl.prototype.encode_number_size = function(obj) {
    var s, isInteger = this.isInt(obj);

    // Handle floats
    if (!isInteger) return 1 + 8;

    // Small int
    if (obj >= 0 && obj < 256) return 1 + 1;

    // 4 byte int
    if (obj >= -2147483648 && obj <= 2147483647) return 1 + 4;

    // Bignum
    var n = 0;
    if (obj < 0) obj = -obj;
    for (; obj; ++n, obj = Math.floor(obj / 256));

    return 1 + 2 + n;
};

Erl.prototype.encode_number = function(obj, dv, offset) {
    /* assuming that obj is numeric, otherwise need to check that: obj === +obj */

    // Handle floats
    if (!this.isInt(obj)) return this.encode_float(obj, dv, offset);

    // Small int...
    if (obj >= 0 && obj < 256) {
        dv.setUint8(offset++, this.Enum.SMALL_INTEGER);
        dv.setUint8(offset++, obj);
        return { data: dv, offset: offset };
    }

    // 4 byte int
    if (obj >= -2147483648 && obj <= 2147483647) {
        dv.setUint8(offset++, this.Enum.INTEGER);
        dv.setUint32(offset, obj);
        return { data: dv, offset: offset+4 };
    }

    // Bignum
    var pos = offset;
    offset += 2; // code, arity
    dv.setUint8(offset++, obj < 0 ? 1 : 0); // Sign
    if (obj < 0) obj = -obj;
    var n = 0;
    for (; obj; ++n, obj = Math.floor(obj / 256)) {
        var i = obj % 256;
        dv.setUint8(offset++, i);
    }
    var code = n < 256 ? this.Enum.SMALL_BIG : this.Enum.LARGE_BIG;
    dv.setUint8(pos++, code);
    dv.setUint8(pos, n);
    return { data: dv, offset: offset };
};

Erl.prototype.encode_float = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.NEW_FLOAT);
    dv.setFloat64(offset, obj);
    return { data: dv, offset: offset+8 };
};

Erl.prototype.encode_atom = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.ATOM);
    dv.setUint16(offset, obj.value.length);
    offset += 2;
    for (let i = 0, n = obj.value.length; i < n; ++i)
        dv.setUint8(offset++, obj.value.charCodeAt(i));
    return { data: dv, offset: offset };
};

Erl.prototype.encode_binary = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.BINARY);
    dv.setUint32(offset, obj.value.length);
    offset += 4;
    for (let i = 0, n = obj.value.length; i < n; ++i)
        dv.setUint8(offset++, obj.value[i]);
    return { data: dv, offset: offset };
};

Erl.prototype.encode_tuple = function(obj, dv, offset) {
    var n = obj.length;
    if (n < 256) {
        dv.setUint8(offset++, this.Enum.SMALL_TUPLE);
        dv.setUint8(offset++, n);
    } else {
        dv.setUint8(offset++, this.Enum.LARGE_TUPLE);
        dv.setUint32(offset, n);
        offset += 4;
    }
    return obj.value.reduce(
        (a, e) => Erl.encode_inner(e, a.data, a.offset),
        {data: dv, offset: offset});
};

Erl.prototype.encode_pid = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.PID);
    var r = this.encode_atom(obj.node, dv, offset);
    offset = r.offset;
    dv.setUint32(offset,  (obj.num >> 15) & 0x7fff); offset += 4;
    dv.setUint32(offset,  (obj.num >>  2) & 0x1fff); offset += 4;
    dv.setUint8 (offset++,(obj.num & 0x3));
    return { data: dv, offset: offset };
};

Erl.prototype.encode_ref = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.NEW_REFERENCE);
    dv.setUint16(offset, obj.ids.length); offset += 2;
    var r = this.encode_atom(obj.node, dv, offset);
    offset = r.offset;
    dv.setUint8(offset++, this.creation);
    offset = obj.ids.reduce((n,i) => { dv.setUint32(n, i); return n+4; }, offset);
    return { data: dv, offset: offset };
};

Erl.prototype.encode_map = function(obj, dv, offset) {
    dv.setUint8(offset++, this.Enum.MAP);
    let len = 0;
    for(let prop in obj.value) if (obj.value.hasOwnProperty(prop)) ++len;
    dv.setUint32(offset, len);
    for(let prop in obj.value) {
        const k = this.encode_inner(prop, dv, offset)
        const v = this.encode_inner(obj[prop], k.data, k.offset)
        dv      = v.data
        offset  = v.offset
    }
    return { data: dv, offset: offset };
}

Erl.prototype.encode_array_size = function(obj) {
    return obj.reduce((a,e) => a + Erl.encode_size(e), obj.length ? 6 : 1)
}

Erl.prototype.encode_array = function(obj, dv, offset) {
    if (obj.length > 0) {
        dv.setUint8(offset++, this.Enum.LIST);
        dv.setUint32(offset, obj.length); offset += 4;
        offset = obj.reduce(
            (n,e) => { var r = Erl.encode_inner(e, dv, n); return r.offset; },
            offset
        );
    }
    dv.setUint8(offset++, this.Enum.NIL);
    return { data: dv, offset: offset };
};

Erl.prototype.encode_assoc_array_size = function(obj) {
    var n = 6 /* list begin/end */;
    for (let key in obj)
        if (obj.hasOwnProperty(key))
            n += 2 /* tuple */
              + this.atom(key).encodeSize()
              + this.encode_size(obj[key]);
    return n;
}

Erl.prototype.encode_assoc_array = function(obj, dv, offset) {
    var arr = [];
    for (let key in obj)
        if (obj.hasOwnProperty(key))
            arr.push(this.tuple(this.atom(key), obj[key]));
    return this.encode_array(arr, dv, offset);
};

//-----------------------------------------------------------------------------
// - DECODING -
//-----------------------------------------------------------------------------

Erl.prototype.decode_inner = function(obj) {
    const dv   = obj.data;
    const type = dv.getUint8(obj.offset);
    switch (type) {
        case this.Enum.SMALL_ATOM:      return this.decode_atom(obj);
        case this.Enum.ATOM:            return this.decode_atom(obj);
        case this.Enum.STRING:          return this.decode_string(obj);
        case this.Enum.SMALL_INTEGER:   return this.decode_integer(obj);
        case this.Enum.INTEGER:
        case this.Enum.SMALL_BIG:
        case this.Enum.LARGE_BIG:       return this.decode_integer(obj);
        case this.Enum.FLOAT:
        case this.Enum.NEW_FLOAT:       return this.decode_float(obj);
        case this.Enum.LIST:            return this.decode_list(obj);
        case this.Enum.MAP:             return this.decode_map(obj);
        case this.Enum.NIL:             return { value: [], offset: obj.offset+1 };
        case this.Enum.SMALL_TUPLE:
        case this.Enum.LARGE_TUPLE:     return this.decode_tuple(obj);
        case this.Enum.BINARY:          return this.decode_binary(obj);
        case this.Enum.PID:             return this.decode_pid(obj);
        case this.Enum.NEW_REFERENCE:   return this.decode_ref(obj);
        default: throw new Error("Unexpected Erlang type: " +
                                type + " at offset " + obj.offset);
    }
};

Erl.prototype.decode_atom = function(obj) {
    var dv = obj.data;
    var offset = obj.offset;
    var n, type = dv.getUint8(offset++);
    switch (type) {
        case this.Enum.ATOM:
            n = dv.getUint16(offset); offset += 2;
            break;
        case this.Enum.SMALL_ATOM:
            n = dv.getUint8(offset++);
            break;
        default:
            throw new Error("Invalid Erlang atom: " +
                            type + " at offset " + offset);
    }
    var a = new Uint8Array(dv.buffer, offset, n);
    offset += n;
    var s = String.fromCharCode.apply(String, a);
    var v;
    switch (s) {
        case "true":      v = true;          break;
        case "false":     v = false;         break;
        case "undefined": v = undefined; break;
        case "null":      v = null;          break;
        default:          v = this.atom(s);
    }
    return { value: v, offset: offset };
};

Erl.prototype.decode_binary = function(obj) {
    var dv = obj.data;
    var offset = obj.offset;
    var type = dv.getUint8(offset++);
    if (type !== this.Enum.BINARY)
        throw new Error("Invalid Erlang binary: " + type + " at offset " + offset);
    var n = dv.getUint32(offset); offset += 4;
    var a = new Array(n);
    for (let i=offset, j=0, m = offset+n; i < m; ++i, ++j) a[j] = dv.getUint8(i);
    return { value: this.binary(a), offset: offset+n };
};

Erl.prototype.decode_integer = function(obj) {
    var dv = obj.data;
    var offset = obj.offset;
    var type = dv.getUint8(offset++);
    var v, arity, sign;
    switch (type) {
        case this.Enum.SMALL_INTEGER:
            v = dv.getUint8(offset++);
            break;
        case this.Enum.INTEGER:
            v = dv.getInt32(offset); offset += 4;
            break;
        case this.Enum.SMALL_BIG:
            arity = dv.getUint8(offset++);
            // Deliverately falling through
        case this.Enum.LARGE_BIG:
            if (type != this.Enum.SMALL_BIG) {
                arity = dv.getUint32(offset); offset += 4;
            }
            if (arity > 8)
                throw new Error("Integer value too large for type: " +
                                type + " arity " + arity);
            sign = dv.getUint8(offset++);
            v = 0;
            for (let i = 0, n = 1; i < arity; ++i, n *= 256)
                v += dv.getUint8(offset++) * n;

            if (sign) v = -v;
            break;
        default:
            throw new Error("Invalid Erlang integer type: " +
                            type + " at offset " + offset);
    }

    return { value: v, offset: offset };
};

Erl.prototype.decode_float = function(obj) {
    var dv = obj.data;
    var offset = obj.offset;
    var type = dv.getUint8(offset++);
    var v, n;
    switch (type) {
        case this.Enum.FLOAT:
            n = 31;
            var A = new Uint8Array(dv.buffer, offset, n);
            offset += n;
            var S = String.fromCharCode.apply(String, A);
            v = parseFloat(S);
            break;
        case this.Enum.NEW_FLOAT:
            v = dv.getFloat64(offset); offset += 8;
            break;
        default:
            throw new Error("Invalid Erlang float type: " +
                            type + " at offset " + offset);
    }
    return { value: v, offset: offset };
};

Erl.prototype.decode_string = function(obj) {
    var dv = obj.data;
    var offset = obj.offset;
    var n, s, type = dv.getUint8(offset++);
    switch (type) {
        case this.Enum.STRING:
            n = dv.getUint16(offset); offset += 2;
            var a = new Uint8Array(dv.buffer, offset, n);
            offset += n;
            s = String.fromCharCode.apply(String, a);
            break;
        case this.Enum.LIST:
            n = dv.getUint32(offset); offset += 4;
            var r = [];
            for (let i = 0; i < n; i++) {
                if (dv.getUint8(offset++) !== this.SMALL_INTEGER)
                    throw new Error("Error decoding string.");
                var c = dv.getUint8(offset++);
                r.push(c);
            }
            s = String.fromCharCode.apply(String, r);
            break;
        case this.Enum.NIL:
            s = "";
            break;
        default:
            throw new Error("Invalid Erlang string type: " +
                            type + " at offset " + offset);
    }
    return { value: s, offset: offset };
};

Erl.prototype.decode_list = function(obj) {
    var dv        = obj.data;
    var offset    = obj.offset;
    var n,r,type  = dv.getUint8(offset++);
    switch (type) {
        case this.Enum.STRING:
            n = dv.getUint16(offset); offset += 2;
            var a = new Uint8Array(dv.buffer, offset, n);
            offset += n;
            r = String.fromCharCode.apply(String, a);
            break;
        case this.Enum.LIST:
            n = dv.getUint32(offset);
            obj.offset = offset + 4;
            r = new Array(n);
            for (let i = 0; i < n; ++i) {
                var res = Erl.decode_inner(obj);
                r[i] = res.value;
                obj.offset = res.offset;
            }
            offset = obj.offset;
            if (dv.byteLength > offset && dv.getUint8(offset) === this.Enum.NIL)
                offset++;
            // Check if the list is an associative array
            if (r.every((e) => e instanceof ErlTuple && e.length === 2 && e.value[0] instanceof ErlAtom)) {
                // Try to convert the associative array to an object
                var b = true;
                var out = {};
                for (let i=0; i < n; ++i) {
                    var e = r[i];
                    var k = e.value[0];
                    if (k in out) {
                        // Key already exists
                        b = false;
                        break;
                    }
                    out[k] = e.value[1];
                }
                if (b)
                    r = out;
            }
            break;
        case this.Enum.NIL:
            r = [];
            break;
        default:
            throw new Error("Invalid Erlang list type: " +
                            type + " at offset " + offset);
    }
    return { value: r, offset: offset };
};

Erl.prototype.decode_map = function(obj) {
    const dv     = obj.data;
    let   offset = obj.offset;
    const type   = dv.getUint8(offset++);
    if (type   !== this.Enum.MAP)
        throw new Error("Invalid map type: " + type);
    const arity  = dv.getUint32(offset);
    obj.offset  += 4;
    let res      = {}
    for (let i=0; i < arity; ++i) {
        const key  = Erl.decode_inner(obj);
        obj.offset = key.offset;
        const val  = Erl.decode_inner(obj);
        obj.offset = val.offset;
        res[key.value] = val.value;
    }
    return {value: res, offset: obj.offset};
}

Erl.prototype.decode_tuple = function(obj) {
    var dv      = obj.data;
    var offset  = obj.offset;
    var n, type = dv.getUint8(offset++);
    switch (type) {
        case this.Enum.SMALL_TUPLE:
            n = dv.getUint8(offset);
            obj.offset = offset + 1;
            break;
        case this.Enum.LARGE_TUPLE:
            n = dv.getUint32(offset);
            obj.offset += 4;
            break;
        default:
            throw new Error("Invalid Erlang tuple type: " +
                            type + " at offset " + offset);
    }
    var r = new Array(n);
    for (let i = 0; i < n; i++) {
        var res = Erl.decode_inner(obj);
        r[i] = res.value;
        obj.offset = res.offset;
    }
    return { value: this.tuple.apply(this, r), offset: obj.offset };
};

Erl.prototype.decode_pid = function(obj) {
    var dv     = obj.data;
    var offset = obj.offset;
    var type   = dv.getUint8(offset++);
    if (type !== this.Enum.PID)
        throw new Error("Invalid pid type: " + type);
    obj.offset = offset;
    var r  = this.decode_atom(obj);
    offset = r.offset;
    var Id = dv.getUint32(offset) & 0x7fff; offset += 4;
    var Sn = dv.getUint32(offset) & 0x1fff; offset += 4;
    var cr = dv.getUint8 (offset++) & 0x3;
    return { value: this.pid(r.value, Id, Sn, cr), offset: offset };
}

Erl.prototype.decode_ref = function(obj) {
    var dv     = obj.data;
    var offset = obj.offset;
    var type   = dv.getUint8(offset++);
    if (type !== this.Enum.NEW_REFERENCE)
        throw new Error("Invalid ref type: " + type);
    var n      = dv.getUint16(offset); offset += 2;
    var ids    = new Array(n);
    obj.offset = offset;
    var r  = this.decode_atom(obj);
    offset = r.offset;
    var cr = dv.getUint8 (offset++) & 0x3;
    for (let i = 0; i < n; ++i, offset += 4)
        ids[i] = dv.getUint32(offset);

    return { value: this.ref(r.value, cr, ids), offset: offset };
}

//-----------------------------------------------------------------------------
// - UTILITY FUNCTIONS -
//-----------------------------------------------------------------------------

Erl.prototype.getClassName = function(obj) {
    var funcNameRegex = /(.{1,}) => \(/;
    var results = (funcNameRegex).exec(obj.constructor.toString());
    return (results && results.length > 1) ? results[1] : "";
};

Erl.prototype.isInt = function(x) { return parseFloat(x) == parseInt(x) && !isNaN(x); }

Erl.prototype.timestampToTuple = function(n) {
    var Ms = Math.floor(n / 1000000000); n -= Ms*1000000000;
    var s  = Math.floor(n / 1000); n -= s*1000;
    var ms = n;
    return new ErlTuple([Ms, s, ms]);
}

Erl.prototype.dateToTuple = function(d) {
    var n  = d.getTime();
    var Ms = Math.floor(n / 1000000000); n -= Ms*1000000000;
    var s  = Math.floor(n / 1000); n -= s*1000;
    var ms = n;
    return new ErlTuple([Ms, s, ms]);
}

var Erl = new Erl();

/*
// Override console log to display Erl objects friendly
(() => {
    var cl = console.log;
    console.log = () => {
        cl.apply(console, [].slice.call(arguments).map((el) => {
            return typeof el === 'object' // {}.toString.call(el) === '[object Object]'
                && typeof el.toString === 'function'
                && el.toString !== Object.prototype.toString ? el.toString() : el;
        }));
    };
    console.oldlog = cl;
}());
*/

// attach the .equals method to Array's prototype to call it on any array
Array.prototype.equals = function(rhs) {
    // if the other rhs is undefined or null return a false value
    if (!rhs)
        return false;

    // compare lengths - can save a lot of time
    if (this.length != rhs.length)
        return false;

    for (let i = 0, l=this.length; i < l; i++) {
        // Check if we have nested arrays
        if (   (this[i] instanceof Array    && rhs[i] instanceof Array)
            || (this[i] instanceof ErlTuple && rhs[i] instanceof ErlTuple)
            || (this[i].equals !== undefined))
        {
            // recurse into the nested arrays
            if (!this[i].equals(rhs[i]))
                return false;
        } else if (this[i] !== rhs[i])
            return false;
    }
    return true;
}

ArrayBuffer.prototype.equals = function(rhs) {
    if (!rhs)
        return false;
    const a = new Uint8Array(this);
    const b = rhs instanceof ArrayBuffer ? new Uint8Array(rhs): rhs;
    // compare lengths - can save a lot of time
    if (a.length != b.length)
        return false;

    for (let i = 0, l=a.length; i < l; ++i)
        if (a[i] !== b[i])
            return false;
    return true;
}

Object.prototype.equals = function(rhs) {
    'use strict';

    if (this === null || this === undefined ||
        rhs  === null || rhs === undefined)               return this === rhs;
    // after this just checking type of one would be enough
    if (this.constructor !== rhs.constructor)             return false;
    // if they are functions, they should exactly refer to same one (because of closures)
    if (this instanceof Function)                         return this === rhs;
    // if they are regexps, they should exactly refer to same one (it is hard to better equality check on current ES)
    if (this instanceof RegExp)                           return this === rhs;
    if (this === rhs || this.valueOf() === rhs.valueOf()) return true;
    if (Array.isArray(this))                              return this.equals(rhs);

    // if they are dates, they must had equal valueOf
    if (this instanceof Date)                             return false;

    // if they are strictly equal, they both need to be object at least
    if (!(this instanceof Object))                        return false;
    if (!(rhs  instanceof Object))                        return false;

    // recursive object equality check
    return Object.keys(rhs) .every(i => this[i] !== undefined) &&
           Object.keys(this).every(i => objectEquals(this[i], rhs[i]));
}

Object.prototype.deepClone = function(obj, override = undefined, filterKeys = () => true) {
    let res = {}

    function doMerge(dst, src, path) {
        for (const [key, val] of Object.entries(src)) {
            if (!filterKeys(path, key)) continue

            if (Array.isArray(val)) {
                dst[key] = val.slice()  // Clone the array
                continue
            } else if (val === null || typeof val !== "object") {
                dst[key] = val
                continue
            }

            if (dst[key] === undefined)
                dst[key] = new val.__proto__.constructor();

            const p = [...path, key]
            doMerge(dst[key], val, p);
        }
    }
    doMerge(res, obj, [])
    if (override !== undefined)
    doMerge(res, override, [])
    return res
}


