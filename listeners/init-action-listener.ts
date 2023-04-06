/**
 * @author Alex Rock alex.rock@flatfile.io
 * @company Flatfile
 */

import { Blueprint } from '@flatfile/api';
import { Client, FlatfileVirtualMachine } from '@flatfile/listener';

const axios = require('axios');
const FormData = require('form-data');

async function generateJSON(event: any, sheetName: string, data: any) {
  const formData = new FormData();
  formData.append('spaceId', event.context.spaceId);

  formData.append('environmentId', event.context.environmentId);
  formData.append('file', JSON.stringify(data), {
    filename: `Sheet ${sheetName}.json`,
  });

  try {
    await axios.post(`v1/files`, formData, {
      headers: formData.getHeaders(),
      transformRequest: () => formData,
    });
  } catch (error) {
    console.log(`upload error: ${JSON.stringify(error, null, 2)}`);
  }
}

const example = Client.create((client) => {
  /**
   * This is a basic hook on events with no sugar on top
   */
  client.on('records:*', { target: 'sheet(TestSheet)' }, async (event) => {
    const { sheetId } = event.context;
    try {
      const records = await event.data;
      const recordsUpdates = records?.records.map((record: any) => {
        record.values.middleName.value = 'TestSheet';

        return record;
      });
      await client.api.updateRecords({
        sheetId,
        recordsUpdates,
      });
    } catch (e) {
      console.log(`Error getting records: ${e}`);
    }
  });

  /**
   * This is a setup of the space with its workbooks
   */
  client.on('client:init', async (event) => {
    // Create a space + workbooks here
    // const blueprintWithAction = useConfigure(SpaceConfig1.mount())

    const blueprintRaw = {
      name: 'Part 8: Listener + Space Config + Custom Action Init',
      slug: 'space-config-custom-action-test-1',
      blueprints: [
        {
          name: 'Workbook Custom Action Test',
          slug: 'space-config-custom-action-test-1/WorkbookCustomActionTest',
          primary: true,
          sheets: [
            {
              fields: [
                {
                  constraints: [],
                  type: 'string',
                  label: 'First Name',
                  key: 'firstName',
                  description: "This is a human's first name",
                },
                {
                  constraints: [],
                  type: 'string',
                  label: 'Middle',
                  key: 'middleName',
                  description: '',
                },
                {
                  constraints: [],
                  type: 'string',
                  label: 'Last Name',
                  key: 'lastName',
                  description: '',
                },
              ],
              slug: 'WorkbookCustomActionTest/TestSheet',
              name: 'TestSheet',
              readonly: false,
              actions: [
                {
                  slug: 'generateJSON',
                  label: 'Generate JSON',
                  description:
                    'Generate a JSON file based off of the Data in this Sheet',
                },
              ],
            },
          ],
        } as Blueprint,
      ],
    };

    const spaceConfig = await client.api.addSpaceConfig({
      spacePatternConfig: blueprintRaw,
    });

    if (!spaceConfig.data?.id) return;

    const space = await client.api.addSpace({
      spaceConfig: {
        name: 'Space Config Custom Action Test',
        spaceConfigId: spaceConfig.data?.id,
        environmentId: event.context.environmentId,
      },
    });
  });

  client.on(
    'action:triggered',
    { target: 'sheet(TestSheet)', action: 'TestSheet:generateJSON' },
    async (e) => {
      e.api.getRecords({
        sheetId: e.context.sheetId,
        versionId: e.context.versionId,
        includeLinks: true,
      });
      const sheetName = e.context.actionName.split(':')[0];
      try {
        const data = (await e.data).records;
        await generateJSON(e, sheetName, data);
      } catch (error) {
        console.log(
          `GenerateJSONAction[error]: ${JSON.stringify(error, null, 2)}`
        );
      }
    }
  );
});

const FlatfileVM = new FlatfileVirtualMachine();

example.mount(FlatfileVM);

export default example;
