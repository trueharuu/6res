#[macro_export]
macro_rules! query {
    ($u:ident.$($i:ident$(.)?)*, $k:ident) => {
        {
            let mut z = &$u;
            $(
                {
                    // println!("{}", stringify!($i));
                    // println!("{z:?}");
                    z = z.as_object().unwrap().get(stringify!($i)).unwrap();
                }
            )*

            z.$k().unwrap()
        }
    };
}

