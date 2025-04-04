import React from 'react';
import { ZodTypeAny, ZodObject, ZodArray, ZodString, ZodDefault, z } from 'zod'; // Added z import
import { ComplianceData } from './schema'; // Assuming schema types are exported

interface SchemaFormRendererProps {
    schema: ZodObject<z.ZodRawShape>; // Use z.ZodRawShape instead of any
    data: ComplianceData;
    onDataChange: (newData: ComplianceData) => void;
    path?: string[]; // To track the path for nested updates
}

// Helper to get the underlying type if it's wrapped (e.g., ZodDefault)
function getBaseType(schema: ZodTypeAny): ZodTypeAny {
    if (schema instanceof ZodDefault) {
        return getBaseType(schema._def.innerType);
    }
    // Add other wrappers like ZodOptional if needed
    return schema;
}


const SchemaFormRenderer: React.FC<SchemaFormRendererProps> = ({
    schema,
    data,
    onDataChange,
    path = [],
}) => {
    const shape = schema.shape;

    // Helper function to handle data updates immutably
    const handleInputChange = (
        currentPath: string[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: any // Acknowledging 'any' is needed here for flexibility
    ) => {
        const newData = JSON.parse(JSON.stringify(data)); // Deep copy for immutability
        let currentLevel = newData;
        for (let i = 0; i < currentPath.length - 1; i++) {
            const key = currentPath[i];
             // Ensure nested objects/arrays exist
             if (currentLevel[key] === undefined || currentLevel[key] === null) {
                 // Determine if the next level should be an array or object based on schema/path
                 // This part needs refinement based on actual schema structure if paths involve arrays
                 currentLevel[key] = {}; // Defaulting to object, might need adjustment
             }
            currentLevel = currentLevel[key];
        }
        currentLevel[currentPath[currentPath.length - 1]] = value;
        onDataChange(newData);
    };

    return (
        <div className="space-y-4 p-4">
            {Object.keys(shape).map((key) => {
                const fieldSchema = getBaseType(shape[key]);
                const currentPath = [...path, key];
                 // Type acc as any within the reduce callback to satisfy ESLint
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fieldData = currentPath.reduce((acc: any, k: string) => acc?.[k], data);
                const description = shape[key].description || key; // Use description or key name

                // --- Render Logic based on Schema Type ---

                // ZodString
                if (fieldSchema instanceof ZodString) {
                    return (
                        <div key={currentPath.join('.')} className="mb-3">
                            <label htmlFor={currentPath.join('.')} className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                                {description}
                            </label>
                            <textarea
                                id={currentPath.join('.')}
                                value={String(fieldData ?? '')} // Ensure value is a string
                                onChange={(e) => handleInputChange(currentPath, e.target.value)}
                                rows={3}
                                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    );
                }

                // ZodArray (Basic String Array for now)
                if (fieldSchema instanceof ZodArray) {
                    const elementType = getBaseType(fieldSchema.element);
                    // Ensure fieldData is treated as an array, default to empty array if null/undefined
                    const arrayData = Array.isArray(fieldData) ? fieldData : [];

                    if (elementType instanceof ZodString) {
                        return (
                            <div key={currentPath.join('.')} className="mb-3 p-3 border rounded-md bg-gray-50">
                                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                                    {description}
                                </label>
                                {arrayData.map((item, index) => (
                                    <div key={index} className="flex items-center mb-2">
                                        <input
                                            type="text"
                                            value={item}
                                            onChange={(e) => {
                                                const newArray = [...arrayData];
                                                newArray[index] = e.target.value;
                                                handleInputChange(currentPath, newArray);
                                            }}
                                            className="flex-grow p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mr-2"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newArray = arrayData.filter((_, i) => i !== index);
                                                handleInputChange(currentPath, newArray);
                                            }}
                                            className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newArray = [...arrayData, '']; // Add empty string
                                        handleInputChange(currentPath, newArray);
                                    }}
                                    className="mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                >
                                    Add Item
                                </button>
                            </div>
                        );
                    }
                     // TODO: Add rendering for arrays of objects (recursive call)
                }

                 // ZodObject (Recursive Call)
                 if (fieldSchema instanceof ZodObject) {
                     return (
                         <div key={currentPath.join('.')} className="mb-3 p-3 border rounded-md">
                              <h3 className="text-md font-semibold mb-2 text-gray-800 capitalize">{description}</h3>
                              <SchemaFormRenderer
                                 schema={fieldSchema}
                                 data={data} // Pass full data down
                                 onDataChange={onDataChange}
                                 path={currentPath} // Pass down the nested path
                             />
                         </div>
                     );
                 }


                // Default fallback for unhandled types
                return (
                    <div key={currentPath.join('.')} className="text-gray-500 text-sm">
                        Unsupported field type for: {key} ({fieldSchema._def.typeName})
                    </div>
                );
            })}
        </div>
    );
};

export default SchemaFormRenderer;
