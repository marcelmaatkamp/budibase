import sanitizeUrl from "./utils/sanitizeUrl"
import { newRowUrl } from "./newRowScreen"
import { Screen } from "./utils/Screen"
import { Component } from "./utils/Component"
import { makePropSafe } from "@budibase/string-templates"

export default function (tables) {
  return tables.map(table => {
    return {
      name: `${table.name} - List`,
      create: () => createScreen(table),
      id: ROW_LIST_TEMPLATE,
    }
  })
}

export const ROW_LIST_TEMPLATE = "ROW_LIST_TEMPLATE"
export const rowListUrl = table => sanitizeUrl(`/${table.name}`)

function generateTitleContainer(table) {
  const newButton = new Component("@budibase/standard-components/button")
    .normalStyle({
      background: "#000000",
      "border-width": "0",
      "border-style": "None",
      color: "#fff",
      "font-weight": "600",
      "font-size": "14px",
    })
    .hoverStyle({
      background: "#4285f4",
    })
    .text("Create New")
    .customProps({
      className: "",
      disabled: false,
      onClick: [
        {
          parameters: {
            url: newRowUrl(table),
          },
          "##eventHandlerType": "Navigate To",
        },
      ],
    })
    .instanceName("New Button")

  const heading = new Component("@budibase/standard-components/heading")
    .normalStyle({
      margin: "0px",
      flex: "1 1 auto",
      "text-transform": "capitalize",
    })
    .type("h2")
    .instanceName("Title")
    .text(table.name)

  return new Component("@budibase/standard-components/container")
    .normalStyle({
      "margin-bottom": "32px",
    })
    .customProps({
      direction: "row",
      hAlign: "stretch",
      vAlign: "middle",
      size: "shrink",
    })
    .instanceName("Title Container")
    .addChild(heading)
    .addChild(newButton)
}

const createScreen = table => {
  const provider = new Component("@budibase/standard-components/dataprovider")
    .instanceName(`Data Provider`)
    .customProps({
      dataSource: {
        label: table.name,
        name: table._id,
        tableId: table._id,
        type: "table",
      },
      paginate: true,
      limit: 8,
    })

  const spectrumTable = new Component("@budibase/standard-components/table")
    .customProps({
      dataProvider: `{{ literal ${makePropSafe(provider._json._id)} }}`,
      theme: "spectrum--lightest",
      showAutoColumns: false,
      quiet: true,
      size: "spectrum--medium",
      rowCount: 8,
    })
    .instanceName(`${table.name} Table`)

  const safeTableId = makePropSafe(spectrumTable._json._id)
  const safeRowId = makePropSafe("_id")
  const viewButton = new Component("@budibase/standard-components/button")
    .customProps({
      text: "View",
      onClick: [
        {
          "##eventHandlerType": "Navigate To",
          parameters: {
            url: `${rowListUrl(table)}/{{ ${safeTableId}.${safeRowId} }}`,
          },
        },
      ],
    })
    .instanceName("View Button")
    .normalStyle({
      background: "transparent",
      "font-weight": "600",
      color: "#888",
      "border-width": "0",
    })
    .hoverStyle({
      color: "#4285f4",
    })

  spectrumTable.addChild(viewButton)
  provider.addChild(spectrumTable)

  const mainContainer = new Component("@budibase/standard-components/container")
    .normalStyle({
      background: "white",
      "border-radius": "0.5rem",
      "box-shadow": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      "border-width": "2px",
      "border-color": "rgba(0, 0, 0, 0.1)",
      "border-style": "None",
      "padding-top": "48px",
      "padding-bottom": "48px",
      "padding-right": "48px",
      "padding-left": "48px",
    })
    .customProps({
      direction: "column",
      hAlign: "stretch",
      vAlign: "top",
      size: "shrink",
    })
    .instanceName("Container")
    .addChild(generateTitleContainer(table))
    .addChild(provider)

  return new Screen()
    .route(rowListUrl(table))
    .instanceName(`${table.name} - List`)
    .addChild(mainContainer)
    .json()
}
