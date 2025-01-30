export const schema = `#graphql

type Contact {
    id: ID!, 
    nombre: String!,
    telefono: String!,
    pais: String!,
    horaActual: String!
}

type Query {
    getContacts: [Contact!]!
    getContact(id: ID!): Contact!
}

type Mutation {
    addContact (nombre: String!, telefono: String!): Contact!
    updateContact (id: ID!, nombre: String, telefono:String): Contact!
    deleteContact (id: ID!): Boolean!
}

`