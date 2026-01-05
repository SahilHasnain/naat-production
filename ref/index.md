'(params: { databaseId: string; collectionId: string; queries?: string[] | undefined; transactionId?: string | undefined; total?: boolean | undefined; }): Promise<DocumentList<DefaultDocument>>' is deprecated.ts(6385)

databases.d.ts(139, 8): The declaration was marked as deprecated here.

(method) Databases.listDocuments<Models.DefaultDocument>(params: {     databaseId: string;     collectionId: string;     queries?: string[];     transactionId?: string;     total?: boolean; }): Promise<Models.DocumentList<Models.DefaultDocument>> (+1 overload)

Get a list of all the user's documents in a given collection. You can use the query params to filter your results.

Get a list of all the user's documents in a given collection. You can use the query params to filter your results.

@param params.databaseId — Database ID.

@param params.collectionId — Collection ID. You can create a new collection using the Database service server integration.

@param params.queries — Array of query strings generated using the Query class provided by the SDK. Learn more about queries. Maximum of 100 queries are allowed, each 4096 characters long.

@param params.transactionId — Transaction ID to read uncommitted changes within the transaction.

@param params.total — When set to false, the total count returned will be 0 and will not be calculated.

@throws — {AppwriteException}

@deprecated — This API has been deprecated since 1.8.0. Please use TablesDB.listRows instead.