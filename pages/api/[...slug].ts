import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

// Interface voor de mapping configuratie
interface MappingRequest {
    method: string
    url: string
    query?: { [key: string]: string }
    headers?: { [key: string]: string }
}

interface MappingResponse {
    status?: number
    body: any // De body kan een object, string of andere data zijn
}

interface Mapping {
    request: MappingRequest
    response: MappingResponse
}

interface MappingsConfig {
    verbose: boolean // Voeg de verbose flag toe aan de configuratie
    mappings: Mapping[]
}

// De catch-all API handler
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    // Laad de mappings.json in
    const mappingsFilePath = path.join(process.cwd(), 'mappings.json')
    const mappingsData = fs.readFileSync(mappingsFilePath, 'utf8')
    const mappings: MappingsConfig = JSON.parse(mappingsData)

    const verbose = mappings.verbose; // Haal de verbose optie op

    if (verbose) {
        console.log(`Incoming Request: ${req.method} ${req.url}`);
        console.log(`Request Headers:`, req.headers);
        console.log(`Request Query:`, req.query);
    }

    // Haal de "slug" (pad van de request) op uit de query
    const { slug } = req.query
    const slugPath = Array.isArray(slug) ? `/${slug.join('/')}` : `/${slug}`

    // Zoek naar een overeenkomstige mapping op basis van method, URL, query en headers
    const match = mappings.mappings.find(mapping => {
        const isMethodMatch = mapping.request.method === req.method
        const isUrlMatch = slugPath.startsWith(mapping.request.url)

        // Query parameters matchen
        const queryMatches = Object.entries(mapping.request.query || {}).every(([key, value]) => {
            const queryValue = req.query[key] || ''
            return queryValue === value
        })

        // Headers matchen
        const headersMatch = Object.entries(mapping.request.headers || {}).every(([key, value]) => {
            const requestHeaderValue = req.headers[key.toLowerCase()]
            return requestHeaderValue === value
        })

        return isMethodMatch && isUrlMatch && queryMatches && headersMatch
    })

    if (match) {
        const response = match.response

        if (verbose) {
            console.log(`Matched Mapping: ${JSON.stringify(match)}`);
        }

        // Verwerk de body dynamisch
        let responseBody: string = JSON.stringify(response.body)

        // Vervang placeholders in de response body
        responseBody = replacePlaceholders(responseBody, req)

        // Log de response als verbose is ingeschakeld
        if (verbose) {
            console.log(`Response Body: ${responseBody}`);
        }

        // Stuur de response terug
        res.status(response.status || 200).json(JSON.parse(responseBody))
    } else {
        // Geen match gevonden
        if (verbose) {
            console.log('No matching mapping found for this request.');
        }
        res.status(404).json({ message: 'No mock configuration found for this request' })
    }
}

// Functie om placeholders in strings te vervangen
function replacePlaceholders(template: string, req: NextApiRequest) {
    return template.replace(/{{(.*?)}}/g, (match, p1) => {
        const pathParts = p1.split('.')

        let value: any = req
        for (let part of pathParts) {
            if (part === "request") {
                // Ga verder met het parsen van de request specifieke onderdelen
            } else {
                value = value ? value[part] : undefined
            }
        }

        return value || '' // Vervang door een lege string als de waarde niet bestaat
    })
}
