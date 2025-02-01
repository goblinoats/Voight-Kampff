import {FC, useState} from 'react';
import styles from './Main.module.css'

import Spreadsheet from "react-spreadsheet"

const Main: FC = () => {
  const [data, setData] = useState([
    [{ value: "Vanilla" }, { value: "Chocolate" }],
    [{ value: "Strawberry" }, { value: "Cookies" }],
  ]);

  const addRow = () => {
    setData([...data, Array(data[0].length).fill({ value: "" })]);
  };

  const addColumn = () => {
    setData(data.map(row => [...row, { value: "" }]));
  };

  return (
    <div>
      <div>
        <Spreadsheet data={data} />
        <button className={styles.newColumnButton} onClick={() => addColumn()}>+</button>
      </div>
      <button className={styles.newRowButton} onClick={() => addRow()}>+</button>
    </div>
  )
};

export default Main;
