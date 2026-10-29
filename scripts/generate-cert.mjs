import selfsigned from "selfsigned";
import fs from "fs";
import path from "path";

const certDir = path.resolve(process.cwd(), "certificates");
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

const attrs = [{ name: "commonName", value: "192.168.100.163" }];
const pems = await selfsigned.generate(attrs, {
  days: 365,
  algorithm: "sha256",
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
        { type: 7, ip: "192.168.100.163" },
      ],
    },
  ],
});

fs.writeFileSync(path.join(certDir, "key.pem"), pems.private);
fs.writeFileSync(path.join(certDir, "cert.pem"), pems.cert);

console.log("Certificates generated successfully in ./certificates");
