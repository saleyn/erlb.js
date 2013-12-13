// erlb.js
// Copyright (c) 2013 Serge Aleynikov <saleyn@gmail.com>
// See BSD for licensing information.


// erlb.js is a Javascript implementation of Erlang Binary External Term Format.
// - http://github.com/erlb.js
//
// For future integration:
// BigInteger: https://github.com/silentmatt/javascript-biginteger

// - CLASSES -

function ErlClass() {}

function ErlAtom(S) {
    //this.type = "Atom";
    this.value = S;

    this.encodeSize = function() { return 1 + 1 + Math.min(255, this.value.length); }
    this.toString = function () { return S; };
}

function ErlBinary(Int8Arr) {
    //this.type = "Binary";
    this.value = Int8Arr;
    this.encodeSize = function() { return 1 + 4 + this.value.length; }
    this.toString = function () {
        return "<<\"" + Int8Arr.join(",") + "\">>";
    }
}

function ErlTuple(Arr) {
    //this.type = "Tuple";
    this.length = Arr.length;
    this.value = Arr;

    this.toString = function () {
        var s = "{";
        if (this.length > 0) s += this.value[0].toString();
        for (var i=1; i < this.value.length; i++)
            s += "," +
                (typeof(this.value[i]) === "string" ? '"'+this.value[i]+'"'
                                                    : this.value[i]);
        return s + "}";
    }
}


// - INTERFACE -

ErlClass.prototype.getClassName = function(Obj) {
   var funcNameRegex = /function (.{1,})\(/;
   var results = (funcNameRegex).exec(Obj.constructor.toString());
   return (results && results.length > 1) ? results[1] : "";
};

ErlClass.prototype.Enum = {
    VERSION         : 131,
    SMALL_ATOM      : 115,
    ATOM            : 100,
    BINARY          : 109,
    SMALL_INTEGER   : 97 ,
    INTEGER         : 98 ,
    SMALL_BIG       : 110,
    LARGE_BIG       : 111,
    FLOAT           : 99 ,
    NEW_FLOAT       : 70 ,
    STRING          : 107,
    LIST            : 108,
    SMALL_TUPLE     : 104,
    LARGE_TUPLE     : 105,
    REFERENCE       : 101,
    NEW_REFERENCE   : 114,
    NIL             : 106,
    ZERO            : 0
}

ErlClass.prototype.encode = function (Obj) {
    var n = this.encode_size(Obj);
    var b = new ArrayBuffer(n);
    var d = new DataView(b)
    d.setUint8(0, this.Enum.VERSION);
    var v = this.encode_inner(Obj, d, 1);
    if (v.offset !== n)
        throw ("Invalid size of encoded buffer: " + len + " expected: " + n);
    return b;
};

ErlClass.prototype.encode_size = function (Obj) {
    switch (typeof(Obj)) {
        case "number":  return 1 + this.encode_number_size(Obj);
        case "string":  return 1 + this.encode_string_size(Obj);
    }
    var s = this.getClassName(Obj);
    switch (s) {
        case "ErlAtom":     return 1 + Obj.encodeSize();
        case "ErlTuple":    return 1 + this.encode_tuple_size(Obj);
        case "ErlBinary":   return 1 + Obj.encodeSize();
        default:
            if (s.indexOf("Array") > -1) return 1 + this.encode_array_size(Obj);
        throw ("Unknown object type: " + s);
    }
};

ErlClass.prototype.decode = function (buffer) {
    var DV = new DataView(buffer, 0);
    if (DV.getUint8(0) !== this.Enum.VERSION) {
        throw ("Not a valid Erlang term.");
    }
    var Obj = this.decode_inner({data: DV, offset: 1});
    if (Obj.offset !== buffer.byteLength) {
        throw ("Erlang term buffer has unused " + buffer.byteLength - Obj.Offset + " bytes");
    }
    return Obj.value;
};

ErlClass.prototype.atom = function (Obj) {
    return new ErlAtom(Obj);
};

ErlClass.prototype.binary = function (Obj) {
    return new ErlBinary(Obj);
};

ErlClass.prototype.tuple = function (Obj) {
    return new ErlTuple(Obj);
};


// - ENCODING -

ErlClass.prototype.encode_inner = function (Obj, dataView, Offset) {
    if (Obj === undefined) throw new Error("Cannot encode undefined values.")
    var func = 'encode_' + typeof(Obj);
    return this[func](Obj, dataView, Offset);
};

ErlClass.prototype.encode_string = function (Obj, DV, Offset) {
    DV.setUint8(Offset++, this.Enum.STRING);
    DV.setUint16(Offset, Obj.length); // FIXME: check length > 0xFF
    Offset += 2;
    for (var i = 0; i < Obj.length; ++i)
        DV.setUint8(Offset++, Obj.charCodeAt(i));
    return { data: DV, offset: Offset };
};

ErlClass.prototype.encode_boolean = function (Obj, DV, Offset) {
    return this.encode_atom(Obj ? "true" : "false", DV, Offset);
};

ErlClass.prototype.encode_number_size = function (Obj) {
    var s, isInteger = (Obj % 1 === 0);

    // Handle floats...
    if (!isInteger) return 1 + 8;

    // Small int...
    if (Obj >= 0 && Obj < 256) return 1 + 1;

    // 4 byte int...
    if (Obj >= -(1 << 31) && Obj <= ((1 << 31)-1)) return 1 + 4;

    // Bignum...
    var n = 0;
    for (; Obj; ++n)
        Obj >>= (n * 8);

    return 1 + 1 + n;  // TODO: fix it for LARGE_BIG
};

ErlClass.prototype.encode_number = function (Obj, DV, Offset) {
    var s, isInteger = (Obj % 1 === 0);

    // Handle floats...
    if (!isInteger) return this.encode_float(Obj, DV, Offset);

    // Small int...
    if (Obj >= 0 && Obj < 256) {
        DV.setUint8(Offset++, this.Enum.SMALL_INTEGER);
        DV.setUint8(Offset++, Obj);
        return { data: DV, offset: Offset };
    }

    // 4 byte int...
    if (Obj >= -(1 << 31) && Obj <= ((1 << 31)-1)) {
        DV.setUint8(Offset++, this.Enum.INTEGER);
        DV.setUint32(Offset++, Obj);
        return { data: DV, offset: Offset };
    }

    // Bignum...
    // TODO
    throw ("BigNum encoding not implemented for: " + Obj);

    var n = 0;
    for (; Obj; ++n)
        Obj >>= (n * 8);
    var code = n < 256 ? this.Enum.SMALL_BIG : this.Enum.LARGE_BIG;
    DV.setUint8(Offset++, code);

    // ...

    n = 0;
    for (; Obj; ++n)
        Obj >>= (n * 8);
};

ErlClass.prototype.encode_float = function (Obj, DV, Offset) {
    DV.setUInt8(Offset++, this.Enum.NEW_FLOAT);
    DV.setFloat64(Offset, Obj);
    Offset += 8;
    return { data: DV, offset: Offset };
};

ErlClass.prototype.encode_object = function (Obj, DV, Offset) {
    // Check if it's an atom, binary, or tuple...
    if (Obj === null){
        return this.encode_inner(this.atom("null"));
    }
    var s = Obj.constructor.toString();

    if (s === "ErlAtom")            return this.encode_atom(Obj, DV, Offset);
    if (s === "Binary")             return this.encode_binary(Obj, DV, Offset);
    if (s === "Tuple")              return this.encode_tuple(Obj, DV, Offset);
    if (s.indexOf("Array") != -1)   return this.encode_array(Obj, DV, Offset);

    // Treat the object as an associative array...
    return this.encode_associative_array(Obj);
};

ErlClass.prototype.encode_atom = function (Obj, DV, Offset) {
    DV.setUInt8(Offset++, this.Enum.ATOM);
    DV.setUint16(Offset, Obj.value.length);
    Offset += 2;
    for (var i = 0; i < Obj.value.length; ++i)
        DV.setUint8(Offset++, Obj.value.charCodeAt(i));
    return { data: DV, offset: Offset };
};

ErlClass.prototype.encode_binary = function (Obj, DV, Offset) {
    DV.setUInt8(Offset++, this.Enum.BINARY);
    DV.setUint32(Offset, Obj.value.length);
    Offset += 4;
    for (var i = 0; i < Obj.value.length; ++i)
        DV.setUint8(Offset++, Obj.value[i]);
    return { data: DV, offset: Offset };
};

ErlClass.prototype.encode_tuple_size = function (Obj) {
    var n = 1 + (Obj.length < 256 ? 1 : 4);
    for (i = 0; i < Obj.length; i++) {
        n += this.encode_inner(Obj.value[i]);
    }
    return n;
}

ErlClass.prototype.encode_tuple = function (Obj, DV, Offset) {
    if (Obj.length < 256) {
        DV.setUInt8(Offset++, this.Enum.SMALL_TUPLE);
        DV.setUInt8(Offset++, Obj.length);
    } else {
        DV.setUInt8(Offset++, this.Enum.LARGE_TUPLE);
        DV.setUInt32(Offset, Obj.length);
        Offset += 4;
    }
    for (i = 0; i < Obj.length; i++) {
        var r = this.encode_inner(Obj[i], DV, Offset);
        Offset = r.offset;
    }
    return { data: DV, offset: Offset };
};

ErlClass.prototype.encode_array_size = function (Obj) {
    var n = 1;
    if (Obj.length > 0) {
        n += 1 + 4;
        for (i = 0; i < Obj.length; i++)
            n += this.encode_size(Obj[i]);
    }
    return n;
};

ErlClass.prototype.encode_array = function (Obj, DV, Offset) {
    if (Obj.length > 0) {
        DV.setUint8(Offset, this.Enum.LIST);
        DV.setUint32(Offset, Obj.length);
        for (i = 0; i < Obj.length; i++) {
            var r = this.encode_inner(Obj[i], DV, Offset);
            Offset = r.offset;
        }
    }
    DV.setUInt8(Offset++, this.Enum.NIL);
    return { data: DV, offset: Offset };
};

ErlClass.prototype.encode_associative_array = function (Obj, DV, Offset) {
    var key, Arr = [];
    for (key in Obj) {
        if (Obj.hasOwnProperty(key)) {
            Arr.push(this.tuple([this.atom(key), Obj[key]]));
        }
    }
    return this.encode_array(Arr);
};



// - DECODING -

ErlClass.prototype.decode_inner = function (Obj) {
    var DV = Obj.data;
    var Type = DV.getUint8(Obj.offset);
    switch (Type) {
        case this.Enum.SMALL_ATOM:      return this.decode_atom(Obj);
        case this.Enum.ATOM:            return this.decode_atom(Obj);
        case this.Enum.STRING:          return this.decode_string(Obj);
        case this.Enum.SMALL_INTEGER:   return this.decode_integer(Obj);
        case this.Enum.INTEGER:
        case this.Enum.SMALL_BIG:
        case this.Enum.LARGE_BIG:       return this.decode_integer(Obj);
        case this.Enum.FLOAT:
        case this.Enum.NEW_FLOAT:       return this.decode_float(Obj);
        case this.Enum.LIST:            return this.decode_list(Obj);
        case this.Enum.NIL:             return { value: [], offset: Obj.offset+1 };
        case this.Enum.SMALL_TUPLE:
        case this.Enum.LARGE_TUPLE:     return this.decode_tuple(Obj, 4);
        case this.Enum.BINARY:          return this.decode_binary(Obj);
        default: throw ("Unexpected Erlang type: " + Type + " at offset " + Obj.offset);
    }
};

ErlClass.prototype.decode_atom = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var N, Type = DV.getUint8(Offset++);
    switch (Type) {
        case this.Enum.ATOM:
            N = DV.getUint16(Offset); Offset += 2;
            break;
        case this.Enum.SMALL_ATOM:
            N = DV.getUint8(Offset++);
            break;
        default:
            throw ("Invalid Erlang atom: " + Type + " at offset " + Offset);
    }
    var A = new Uint8Array(DV.buffer, Offset, N);
    Offset += N;
    var S = String.fromCharCode.apply(String, A);
    if (S === "true")
        V = true;
    else if (S === "false")
        V = false;
    else
        V = this.atom(S);
    return { value: V, offset: Offset };
};

ErlClass.prototype.decode_binary = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var Type = DV.getUint8(Offset++);
    if (Type !== this.Enum.BINARY)
        throw ("Invalid Erlang binary: " + Type + " at offset " + Offset);
    var N = DV.getUint32(Offset); Offset += 4;
    var A = new Uint8Array(DV.buffer, Offset, N);
    return { value: this.binary(A), offset: Offset };
};

ErlClass.prototype.decode_integer = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var Type = DV.getUint8(Offset++);
    var V, Arity, Sign;
    switch (Type) {
        case this.Enum.SMALL_INTEGER:
            V = DV.getInt8(Offset++);
            break;
        case this.Enum.INTEGER:
            V = DV.getInt32(Offset); Offset += 4;
            break;
        case this.Enum.SMALL_BIG:
            Arity = DV.getUint8(Offset++);
            // Deliverately falling through
        case this.Enum.LARGE_BIG:
            if (Type != this.Enum.SMALL_BIG) {
                Arity = DV.getUint32(Offset); Offset += 4;
            }
            if (Arity > 8)
                throw ("Integer value too large for type: " + Type + " arity " + Arity);
            Sign = DV.getUint8(Offset++);
            V = 0;
            for (var i = 0; i < Arity; i++)
                V |= DV.getUint8(Offset++) << (i * 8);

            if (Sign)
                V = -V;
            break;
        default:
            throw ("Invalid Erlang integer type: " + Type + " at offset " + Offset);
    }

    return { value: V, offset: Offset };
};

ErlClass.prototype.decode_float = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var Type = DV.getUint8(Offset++);
    var V, N;
    switch (Type) {
        case this.Enum.FLOAT:
            N = 31;
            var A = new Uint8Array(DV.buffer, Offset, N);
            Offset += N;
            var S = String.fromCharCode.apply(String, A);
            V = parseFloat(S);
            break;
        case this.Enum.NEW_FLOAT:
            V = DV.getFloat64(Offset); Offset += 8;
            break;
        default:
            throw ("Invalid Erlang float type: " + Type + " at offset " + Offset);
    }
    return { value: V, offset: Offset };
};

ErlClass.prototype.decode_string = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var N, S, Type = DV.getUint8(Offset++);
    switch (Type) {
        case this.Enum.STRING:
            N = DV.getUint16(Offset); Offset += 2;
            var A = new Uint8Array(DV.buffer, Offset, N);
            Offset += N;
            S = String.fromCharCode.apply(String, A);
            break;
        case this.Enum.LIST:
            N = DV.getUint32(Offset); Offset += 4;
            var R = [];
            for (var i = 0; i < N; i++) {
                if (DV.getUint8(Offset++) !== this.SMALL_INTEGER)
                    throw ("Error decoding string.");
                var C = DV.getUint8(Offset++);
                R.push(C);
            }
            S = String.fromCharCode.apply(String, R);
            break;
        case this.Enum.NIL:
            S = "";
            break;
        default:
            throw ("Invalid Erlang string type: " + Type + " at offset " + Offset);
    }
    return { value: S, offset: Offset };
};

ErlClass.prototype.decode_list = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var N, R, Type = DV.getUint8(Offset++);
    switch (Type) {
        case this.Enum.STRING:
            N = DV.getUint16(Offset); Offset += 2;
            var A = new Uint8Array(DV.buffer, Offset, N);
            Offset += N;
            R = String.fromCharCode.apply(String, A);
            break;
        case this.Enum.LIST:
            N = DV.getUint32(Offset);
            Obj.offset = Offset + 4;
            R = [];
            for (var i = 0; i < N; i++) {
                var Res = this.decode_inner(Obj);
                R.push(Res.value);
                Obj.offset = Res.offset;
            }
            Offset = Obj.offset;
            if (DV.byteLength > Offset && DV.getUint8(Offset) === this.Enum.NIL)
                Offset++;
            break;
        case this.Enum.NIL:
            R = [];
            break;
        default:
            throw ("Invalid Erlang list type: " + Type + " at offset " + Offset);
    }
    return { value: R, offset: Offset };
};

ErlClass.prototype.decode_tuple = function (Obj) {
    var DV = Obj.data;
    var Offset = Obj.offset;
    var N, R, Type = DV.getUint8(Offset++);
    switch (Type) {
        case this.Enum.SMALL_TUPLE:
            N = DV.getUint8(Offset);
            Obj.offset = Offset + 1;
            break;
        case this.Enum.LARGE_TUPLE:
            N = DV.getUint32(Offset);
            Obj.offset = Offset + 4;
            break;
        default:
            throw ("Invalid Erlang tuple type: " + Type + " at offset " + Offset);
    }
    R = [];
    for (var i = 0; i < N; i++) {
        var Res = this.decode_inner(Obj);
        R.push(Res.value);
        Obj.offset = Res.offset;
    }
    return { value: this.tuple(R), offset: Obj.offset };
};

// - UTILITY FUNCTIONS -

var Bert = new ErlClass();
