import * as React from 'react';
import { useCallback, useState } from 'react'
import { render } from 'react-dom';
import { useDropzone } from 'react-dropzone'
import { decode } from 'bencodex';
import { Buffer } from 'buffer';

function BencodexViewer() {
    const [value, setValue] = useState(undefined);
    const onDrop = useCallback(acceptedFiles => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            file.arrayBuffer().then((aBuffer: ArrayBuffer) => {
                const buffer: Buffer = Buffer.from(aBuffer);
                setValue(decode(buffer));
            });
        }
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop
    });

    return <>
        <div {...getRootProps()}>
            <input {...getInputProps()} />
            {isDragActive
                ? <p>Drop the files here&hellip;</p>
                : <p>Drag &amp; drop some files here, or click to select files</p>
            }
        </div>
        {typeof value == 'undefined'
            ? <></>
            : <BencodexTree value={value} />
        }
    </>;
}

function BencodexTree({ value }) {
    if (value === null) {
        return <div>null</div>;
    }
    else if (typeof value == 'boolean') {
        return <div>{value ? 'true' : 'false'}</div>;
    }
    else if (typeof value == 'bigint') {
        return <div>{value}</div>;
    }
    else if (typeof value == 'string') {
        return (<div>&quot;{value}&quot;</div>);
    }
    else if (value instanceof Uint8Array) {
        const hex = value.reduce(
            (s, b) => s + (b < 0x10 ? '0' : '') + b.toString(16),
            ''
        );
        const allAsciiChars = value.every(b => 0x20 <= b && b <= 0x7e);
        return <div>
            {hex}
            {allAsciiChars
                ? <>
                    <br />
                    <span>&quot;{
                        String.fromCharCode.apply(null, value)
                    }&quot;</span></>
                : <></>}
        </div>;
    }
    else if (value instanceof Array) {
        return <div>{value.map(e => <BencodexTree value={e} />)}</div>;
    }
    else if (value instanceof Map) {
        // For readability, list dictionary keys in lexicographical order.
        const pairs = Array.from(value).sort(([a,], [b,]) => {
            if (a instanceof Uint8Array) {
                if (typeof b == 'string') return -1;
                const length = Math.max(a.byteLength, b.byteLength);
                for (let i: number = 0; i < length; i++) {
                    if (a.byteLength <= i) return 1;
                    else if (b.byteLength <= i) return -1;
                    else if (a[i] < b[i]) return -1;
                    else if (a[i] > b[i]) return 1;
                }

                return 0;
            }
            else if (typeof a  == 'string') {
                if (b instanceof Uint8Array) return 1;
                return a < b ? -1 : (a > b ? 1 : 0);
            }

            return 0;
        });
        return (
            <table>
                {pairs.map(([k, v]) =>
                    <tr>
                        <th><BencodexTree value={k} /></th>
                        <td><BencodexTree value={v} /></td>
                    </tr>
                )}
            </table>
        );
    }

    throw new TypeError(
        'expected one of: null, boolean, bigint, string, Array, Uint8Array, ' +
        'and Map'
    );
}

render(<BencodexViewer />, document.getElementById('app'));
