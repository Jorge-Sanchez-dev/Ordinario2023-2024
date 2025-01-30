import { ClientSession, Collection, ObjectId } from "mongodb";
import { UsuarioModelo, APIPhone, APIHora } from "./types.ts";
import { GraphQLError } from "graphql";

type Context = {
    UsersCollection: Collection<UsuarioModelo>;
};

type QueryArs = {
    id: string
}

type AddArgs = {
    nombre: string,
    telefono: string
}

type UpdateArgs = {
    id: string,
    nombre: string,
    telefono: string,
}

const conseguirHora = async (pais: string, API_KEY: string): Promise<string> => {
    const urlHora = `https://api.api-ninjas.com/v1/worldtime?city=${pais}`;
    const response = await fetch(urlHora, {
        headers: { "X-Api-Key": API_KEY },
    });

    if (response.status !== 200) throw new GraphQLError("API Ninja Error");

    const data: APIHora = await response.json();
    return data.datetime;
}

// Función para validar el teléfono a través de la API y verificar si ya existe en la base de datos
const validarTelefono = async (telefono: string, ctx: Context, API_KEY: string): Promise<APIPhone> => {
    // Verificar si el teléfono ya está registrado
    const telefonoExistente = await ctx.UsersCollection.countDocuments({ telefono });
    if (telefonoExistente > 0) {
        throw new GraphQLError("El teléfono ya está registrado.");
    }

    // Validar el teléfono utilizando la API
    const urlTelefono = `https://api.api-ninjas.com/v1/validatephone?number=${telefono}`;
    const data = await fetch(urlTelefono, {
        headers: { "X-Api-Key": API_KEY },
    });

    if (data.status !== 200) throw new GraphQLError("API Ninja Error");

    const response: APIPhone = await data.json();
    if (!response.is_valid) {
        throw new GraphQLError("El número de teléfono no es válido.");
    }

    return response;
}


export const resolvers = {
  Query: {
    getContacts: async (
        _: unknown, 
        __: unknown, //lo que va a recibir
        ctx: Context,
    ): Promise<UsuarioModelo[]> => {
        const user = await ctx.UsersCollection.find().toArray();
        return user;
    },
    
    getContact: async (
        _: unknown,
        args: QueryArs,
        ctx: Context
    ): Promise<UsuarioModelo | null> => {
        const {id} = args;

        if(!ObjectId.isValid(id)){
            throw new GraphQLError("El ID no es valido.");
        }

        const user = await ctx.UsersCollection.findOne(
            {_id: new ObjectId(id)}
        );

        if(!user){
            throw new GraphQLError("Usuario no encontrado.");
        }

        return user;
    }
  },

  Mutation: {
    /*
    addContact, cuyos parámetros deben ser:
        _Nombres y apellidos, tipo: _"Alberto Romero Sanz"*
        Número de teléfono incluyendo prefijo nacional, tipo: "+34645543345"
    */
    addContact: async (
        _: unknown,
        args: AddArgs,
        ctx: Context
    ):Promise<UsuarioModelo> => {
        const API_KEY = Deno.env.get("API_KEY");

        if(!API_KEY){
            throw new GraphQLError("Necesitas una API Ninja. ")
        }

        const {nombre, telefono} = args;

        // Validar el teléfono y obtener los datos de país y hora
        const response = await validarTelefono(telefono, ctx, API_KEY);

        const nuevoPais = response.country;
        // Obtener la hora actual del país usando la API worldtime
        const hora = await conseguirHora(nuevoPais, API_KEY);

        const {insertedId} = await ctx.UsersCollection.insertOne({
            nombre: nombre,
            telefono: telefono,
            pais: nuevoPais,
            horaActual: hora,
        });

        return {
            _id: insertedId,
            nombre: nombre, 
            telefono: telefono,
            pais: nuevoPais,
            horaActual: hora,
        }

    },
    updateContact: async (
        _: unknown,
        args: UpdateArgs, //le paso solo el id
        ctx: Context
    ): Promise<UsuarioModelo> => {
        const API_KEY = Deno.env.get("API_KEY");
        const { id, nombre, telefono } = args;

        if (!nombre && !telefono) {
            throw new GraphQLError("You must at least update one value");
          }

        if (!API_KEY) {
            throw new GraphQLError("Necesitas una API Ninja.");
        }

         // Verificar si el ID es válido
         if (!ObjectId.isValid(id)) {
            throw new GraphQLError("El ID no es válido.");
        }

        // Buscar el contacto por el ID
        const user = await ctx.UsersCollection.findOne({ 
            _id: new ObjectId(id) 
        });

        if (!user) {
            throw new GraphQLError("Usuario no encontrado.");
        }

        //Si solo se cambia el nombre
        if (!telefono) {
            const newUser = await ctx.UsersCollection.findOneAndUpdate(
                {_id: new ObjectId(id)}, 
                { $set: { nombre } },
        );

            if (!newUser) throw new GraphQLError("User not found!");
            return newUser;
        }


        const telefonoExists = await ctx.UsersCollection.findOne({ telefono });
        if (telefonoExists && telefonoExists._id.toString() !== id) {
            throw new GraphQLError("El telefono ya existe");
        }

        const telefonoActualizar = await validarTelefono(telefono, ctx, API_KEY);
        if(!telefonoActualizar.is_valid){
                throw new GraphQLError("El telefono no es valido");
        }

        const paisActualizado = telefonoActualizar.country;
        const horaActualizada = await conseguirHora(paisActualizado, API_KEY);

            // Actualizamos los campos
        const ActualizarUser = await ctx.UsersCollection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    nombre: nombre || user.nombre,
                    telefono,
                    pais: paisActualizado,
                    horaActual: horaActualizada,
                },
            },
        );

        // Después de la actualización, buscamos nuevamente el usuario actualizado
        if (!ActualizarUser) {
            throw new GraphQLError("Usuario no encontrado después de la actualización.");
        }

        return ActualizarUser;
    },

    // esto es un comentario par aprobar
    deleteContact: async (
        _: unknown,
        args: QueryArs,
        ctx: Context
    ): Promise<boolean> => {
        const {id} = args;

        if(!ObjectId.isValid(id)){
            throw new GraphQLError("El ID no es valido.");
        }

        const result = await ctx.UsersCollection.deleteOne(
            {_id: new ObjectId(id)}
        );

        if (result.deletedCount === 0){
            return false;
        }
        
        return true;
    }
    },
};