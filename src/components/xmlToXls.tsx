import React, { useState } from "react";
import * as XLSX from "xlsx";
import iconv from "iconv-lite";

interface Surgery {
  "Data Realização": string;
  "Aviso Cirurgia": string;
  Cirurgia: string;
  "Código Paciente": string;
  "Nome Paciente": string;
  Anestesista: string;
  "Tipo Anestesia": string;
}

const XMLToExcelConverter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partialData, setPartialData] = useState<Surgery[]>([]);

  //   const addXmlDeclaration = (xmlString: string): string => {
  //     // If the string starts with an XML declaration, replace it with one that includes encoding
  //     if (xmlString.startsWith("<?xml")) {
  //       // Replace existing XML declaration with the new one including UTF-8 encoding
  //       return xmlString.replace(
  //         /<\?xml version="1.0"[^>]*\?>/,
  //         '<?xml version="1.0" encoding="UTF-8"?>',
  //       );
  //     }
  //     // If no declaration, add the UTF-8 encoding declaration at the top
  //     return '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
  //   };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0]);
      setError(null);
      setPartialData([]);
    }
  };

  const sanitizeXML = (xmlString: string): string => {
    if (xmlString.charCodeAt(0) === 0xfeff) {
      xmlString = xmlString.slice(1);
    }
    // Remove problematic $ characters from tag names
    return xmlString.replace(/<(\/?)\w+\$/g, "<$1");
  };

  const parseXML = (xmlString: string): Surgery[] => {
    const sanitizedXml = sanitizeXML(xmlString);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(sanitizedXml, "text/xml");

    const parseErrors = xmlDoc.getElementsByTagName("parsererror");
    if (parseErrors.length > 0) {
      const errorText = parseErrors[0].textContent;
      throw new Error(`XML parsing error: ${errorText}`);
    }

    const surgeries: Surgery[] = [];

    const processElement = (element: Element) => {
      if (element.tagName === "G_DT_REALIZACAO") {
        const date =
          element.getElementsByTagName("DT_REALIZACAO")[0]?.textContent || "";

        const patientElements = element.getElementsByTagName("G_NM_PACIENTE");
        for (let j = 0; j < patientElements.length; j++) {
          const patientElement = patientElements[j];
          const surgeryElement =
            patientElement.getElementsByTagName("LIST_G_CIRURGIA")[0];
          const gSurgeryElements =
            surgeryElement.getElementsByTagName("G_CIRURGIA");

          for (let h = 0; h < gSurgeryElements.length; h++) {
            const surgeryElement = gSurgeryElements[h];

            if (surgeryElement) {
              const anesthesiaType =
                surgeryElement.getElementsByTagName("DS_TIP_ANEST")[0]
                  ?.textContent;

              if (anesthesiaType !== "LOCAL") {
                surgeries.push({
                  "Data Realização": date,
                  "Aviso Cirurgia":
                    patientElement.getElementsByTagName("CD_AVISO_CIRURGIA")[0]
                      ?.textContent || "",
                  Cirurgia:
                    surgeryElement.getElementsByTagName(
                      "DECODE_NVL_CIR_AVI_DS_NPADRONI"
                    )[0]?.textContent || "",
                  "Código Paciente":
                    patientElement.getElementsByTagName("CD_PACIENTE")[0]
                      ?.textContent || "",
                  "Nome Paciente":
                    patientElement.getElementsByTagName("NM_PACIENTE")[0]
                      ?.textContent || "",
                  Anestesista:
                    surgeryElement.getElementsByTagName("CF_NM_ANESTESISTA")[0]
                      ?.textContent || "",
                  "Tipo Anestesia": anesthesiaType || "",
                });
              }
            }
          }
        }
      }

      for (let i = 0; i < element.children.length; i++) {
        processElement(element.children[i]);
      }
    };

    try {
      processElement(xmlDoc.documentElement);
    } catch (err) {
      console.error("Erro durante o processamento do XML:", err);
      setError(
        `Erro durante o processamento do XML: ${(err as Error).message}`
      );
    }

    return surgeries;
  };

  const convertToExcel = (data: Surgery[]) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cirurgias");
    XLSX.writeFile(workbook, "cirurgias.xlsx", {
      bookType: "xlsx",
      type: "binary",
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlString = e.target?.result as string;
        const encodedXml = iconv.decode(Buffer.from(xmlString), "ISO-8859-1");
        const parsedData = parseXML(encodedXml);
        setPartialData(parsedData);
        if (parsedData.length > 0) {
          convertToExcel(parsedData);
          setError(null);
        } else {
          setError("Nenhum dado valido encontrado no arquivo XML.");
        }
      } catch (err) {
        setError(`Erro ao processar o arquivo: ${(err as Error).message}`);
      }
    };
    reader.onerror = () => {
      setError("Erro ao ler o arquivo.");
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          color: "#000",
        }}
      >
        XML para Excel
      </h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div>
          <label
            htmlFor="xmlFile"
            style={{
              display: "block",
              fontSize: "0.875rem",
              fontWeight: "500",
              color: "#000",
            }}
          >
            Upload XML
          </label>
          <input
            type="file"
            id="xmlFile"
            accept=".xml"
            onChange={handleFileChange}
            style={{
              marginTop: "0.25rem",
              display: "block",
              width: "100%",
              fontSize: "0.875rem",
              color: "#000",
            }}
          />
        </div>
        <button
          type="submit"
          style={{
            display: "inline-flex",
            justifyContent: "center",
            padding: "0.5rem 1rem",
            border: "none",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            color: "white",
            backgroundColor: "#4F46E5",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          Converter para Excel
        </button>
      </form>
      {error && (
        <div style={{ marginTop: "1rem", color: "#DC2626" }}>{error}</div>
      )}
      {partialData.length > 0 && (
        <div style={{ marginTop: "1rem", color: "#16A34A" }}>
          {partialData.length} registros processados.
        </div>
      )}
    </div>
  );
};

export default XMLToExcelConverter;
