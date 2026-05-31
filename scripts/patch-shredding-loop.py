#!/usr/bin/env python3
"""Replace the flat shredding loop in rfpSessions.ts with tier-aware branching."""

with open('/home/ubuntu/amplify-proposals/server/routers/rfpSessions.ts', 'r') as f:
    content = f.read()

old = '''            const documentFragments: string[] = [];
            for (let i = 0; i < allFiles.length; i++) {
              if (i > 0) await new Promise((r) => setTimeout(r, 1500));
              const { type: docType, label } = classifyFile(allFiles[i].name, i);
              await writeSubStep(`Shredding file ${i + 1} of ${allFiles.length}: ${allFiles[i].name}`);
              try {
                const fragment = await shredSingleFile({
                  fileName: allFiles[i].name,
                  fileUrl: allFiles[i].url,
                  mimeType: allFiles[i].mimeType,
                  fileRole: docType === "main_rfp" ? "primary" : "attachment",
                  asFragment: true,
                });
                // Wrap the shredded content in a <document> tag with metadata
                documentFragments.push(
                  `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(allFiles[i].name)}">\\n${fragment}\\n  </document>`
                );
              } catch (err: any) {
                // If one file fails, log it and continue
                documentFragments.push(
                  `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(allFiles[i].name)}" status="error">\\n    <error>${escapeXml(err.message ?? "Unknown error")}</error>\\n  </document>`
                );
              }
            }'''

new = '''            const documentFragments: string[] = [];
            let fullExtractCount = 0;
            let metadataOnlyCount = 0;
            let sheetjsCount = 0;

            for (let i = 0; i < allFiles.length; i++) {
              if (i > 0) await new Promise((r) => setTimeout(r, 1500));
              const fileEntry = allFiles[i] as { name: string; url: string; mimeType: string; label?: string };
              const { type: docType, label, tier } = classifyFile(fileEntry.name, i, fileEntry.label);

              if (tier === "sheetjs") {
                // Fee Schedule XLSX: SheetJS parse only, no LLM
                sheetjsCount++;
                await writeSubStep(`Parsing fee schedule ${i + 1}/${allFiles.length}: ${fileEntry.name} (SheetJS)`);
                documentFragments.push(
                  `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="sheetjs" processing="skipped-sheetjs-parse-only">\\n    <metadata>\\n      <title>${escapeXml(fileEntry.name.replace(/\\.[^.]+$/, ""))}</title>\\n      <note>Fee schedule XLSX - SheetJS parse only, not submitted to LLM. Review manually.</note>\\n    </metadata>\\n  </document>`
                );
              } else if (tier === "metadata_only") {
                // Appendix, Forms, Certs, Reference Docs: metadata only, skip LLM
                metadataOnlyCount++;
                await writeSubStep(`Cataloguing ${i + 1}/${allFiles.length}: ${fileEntry.name} (metadata only)`);
                documentFragments.push(
                  `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="metadata_only" processing="skipped-metadata-only">\\n    <metadata>\\n      <title>${escapeXml(fileEntry.name.replace(/\\.[^.]+$/, ""))}</title>\\n      <url>${escapeXml(fileEntry.url)}</url>\\n      <note>Catalogued without LLM extraction. File stored and available for reference.</note>\\n    </metadata>\\n  </document>`
                );
              } else {
                // Full extract: Main RFP, Scope of Work, Addendum
                fullExtractCount++;
                await writeSubStep(`Shredding file ${i + 1}/${allFiles.length}: ${fileEntry.name} (full extract)`);
                try {
                  const fragment = await shredSingleFile({
                    fileName: fileEntry.name,
                    fileUrl: fileEntry.url,
                    mimeType: fileEntry.mimeType,
                    fileRole: docType === "main_rfp" ? "primary" : "attachment",
                    asFragment: true,
                  });
                  documentFragments.push(
                    `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="full_extract">\\n${fragment}\\n  </document>`
                  );
                } catch (err: any) {
                  documentFragments.push(
                    `  <document type="${docType}" label="${escapeXml(label)}" filename="${escapeXml(fileEntry.name)}" tier="full_extract" status="error">\\n    <error>${escapeXml(err.message ?? "Unknown error")}</error>\\n  </document>`
                  );
                }
              }
            }

            console.log(`[rfp_parser] tier summary: ${fullExtractCount} full-extract, ${metadataOnlyCount} metadata-only, ${sheetjsCount} sheetjs (of ${allFiles.length} total)`);'''

if old not in content:
    print("ERROR: old block not found!")
    exit(1)

new_content = content.replace(old, new, 1)

with open('/home/ubuntu/amplify-proposals/server/routers/rfpSessions.ts', 'w') as f:
    f.write(new_content)

print("SUCCESS: shredding loop replaced with tier-aware branching")
