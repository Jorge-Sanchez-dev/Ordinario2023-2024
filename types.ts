import {OptionalId} from "mongodb"

export type UsuarioModelo = OptionalId<{
    nombre: string,
    telefono: string,
    pais: string,
    horaActual: string
}>

export type Ususario = {
    id: string
    nombre: string,
    telefono: string,
    pais: string,
    horaActual: string
}


// https://api.api-ninjas.com/v1/validatephone?number=+12065550100
export type APIPhone = {
    is_valid: boolean,
    country: string,
    timezones: string[],
}

//https://api.api-ninjas.com/v1/worldtime?city=london
export type APIHora = {
    datetime: string,
}