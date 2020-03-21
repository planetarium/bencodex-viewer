import * as React from 'react';
import { useCallback, useState } from 'react'
import { render } from 'react-dom';
import { useDropzone } from 'react-dropzone'
import { decode } from 'bencodex';
import { Buffer } from 'buffer';
import styled from '@emotion/styled';
import HexEditor from 'react-hex-editor';

const BencodexDropzone = styled.div`
    border: 10px dashed silver;
    border-radius: 10px;
    color: gray;
    font-family: sans-serif;
    padding: 10px;
    margin-bottom: 10px;
    &[data-active=active] {
        border-style: solid;
        border-color: gray;
        color: #333;
    }
`;

const BencodexViewer = () => {
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
        <BencodexDropzone
            {...getRootProps()}
            data-active={isDragActive ? 'active' : 'inactive'}>

            <input {...getInputProps()} />
            {isDragActive
                ? <p>Drop the Bencodex file&hellip;</p>
                : <p>Drag &amp; drop a Bencodex file here,
                    or click to select a file</p>
            }
        </BencodexDropzone>
        {typeof value == 'undefined'
            ? <></>
            : <BencodexTree value={value} />
        }
    </>;
};

const BencodexUnicodeString = styled.span`
    &:before { content: '\u201c'; }
    &:after { content: '\u201d'; }
    &:hover:after {
        content: '\u201d (' attr(data-length) ')';
    }
`;

const BencodexByteString = styled.span`
    font-family: monospace;
    .hex span { margin-right: 0.2em; }
    .hex:hover:after {
        content: ' (' attr(data-length) ')';
    }
    .ascii {
        display: block;
        font-family: monospace;
        &:before { content: '(ASCII: "'; }
        &:after { content: '")'; }
        opacity: 0.7;
    }
    .hex .h, .ascii .h { color: red; }
`;

const BencodexList = styled.table`
    border: 1px solid transparent;
    border-collapse: collapse;
    &:hover {
        border: 1px solid black;
    }
    caption {
        background-color: #333;
        color: white;
    }
    tr:nth-of-type(odd) {
        background-color: #eee;
    }
    tr:nth-of-type(even) {
        background-color: white;
    }
    tr:hover {
        background-color: #ddd;
    }
    th {
        font-weight: normal;
        text-align: left;
    }
`;

const BencodexDictionary = styled.table`
    border: 1px solid transparent;
    border-collapse: collapse;
    &:hover {
        border: 1px solid black;
    }
    caption {
        background-color: #333;
        color: white;
    }
    tr:nth-of-type(odd) {
        background-color: #eee;
    }
    tr:nth-of-type(even) {
        background-color: white;
    }
    tr:hover {
        background-color: #ddd;
    }
    th {
        font-weight: normal;
        text-align: left;
    }
`;


const BencodexTree = ({ value }) => {
    const [highlightedIndex, highlightIndex] = useState(null);

    if (value == null && typeof value != 'undefined') {
        return <div className="null">null</div>;
    }
    else if (typeof value == 'boolean') {
        return <div className="boolean">{value ? 'true' : 'false'}</div>;
    }
    else if (typeof value == 'bigint') {
        return <div className="integer">{value.toString()}</div>;
    }
    else if (typeof value == 'string') {
        return <BencodexUnicodeString data-length={value.length}>
            {value}
        </BencodexUnicodeString>;
    }
    else if (value instanceof Uint8Array) {
        if (value.length > 100) {
            return <HexEditor
                showAscii
                columns={0x10}
                height={400}
                rowHeight={22}
                rows={0x10}
                width={1000}
                data={value}
            />;
        }
        const hex = [];
        value.forEach((b, i) =>
            hex.push(
                <span key={i}
                    className={highlightedIndex === i ? 'h' : ''}
                    onMouseEnter={() => highlightIndex(i)}
                    onMouseLeave={() => highlightIndex(null)}>{
                    (b < 0x10 ? '0' : '') + b.toString(16)
                }</span>
            )
        );
        const allAsciiChars = value.every(b => 0x20 <= b && b <= 0x7e);
        return <BencodexByteString>
            <span className="hex" data-length={value.byteLength}>{hex}</span>
            {allAsciiChars
                ? <>
                    {' '}
                    <span className="ascii">{Array.from(value).map((b, i) =>
                        <span key={i}
                            className={highlightedIndex === i ? 'h' : ''}
                            onMouseEnter={() => highlightIndex(i)}
                            onMouseLeave={() => highlightIndex(null)}>{
                            String.fromCharCode(b)
                        }</span>
                    )}</span></>
                : <></>}
        </BencodexByteString>;
    }
    else if (value instanceof Array) {
        return (
            <BencodexList>
                <caption>
                    {value.length}
                    {value.length == 1 ? ' elements' : ' elements'}
                </caption>
                <tbody>
                    {value.map((e, i) =>
                        <tr key={i}>
                            <th>{i}</th>
                            <td><BencodexTree value={e} /></td>
                        </tr>
                    )}
                </tbody>
            </BencodexList>
        );
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
            <BencodexDictionary>
                <caption>
                    {pairs.length}
                    {pairs.length == 1 ? ' key' : ' keys'}
                </caption>
                <tbody>
                    {pairs.map(([k, v], i) =>
                        <tr key={i}>
                            <th><BencodexTree value={k} /></th>
                            <td><BencodexTree value={v} /></td>
                        </tr>
                    )}
                </tbody>
            </BencodexDictionary>
        );
    }

    throw new TypeError(
        'expected one of: null, boolean, bigint, string, Array, Uint8Array, ' +
        'and Map'
    );
};

render(<BencodexViewer />, document.getElementById('app'));
